package com.example.quizhub.service.quiz.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.Random;
import com.example.quizhub.entity.enums.Role;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.quizhub.dto.quiztaking.request.QuestionSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.request.QuizSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.response.AnswerTakingResponseDTO;
import com.example.quizhub.dto.quiztaking.response.QuestionTakingResponseDTO;
import com.example.quizhub.dto.quiztaking.response.QuizResultResponseDTO;
import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.entity.Answer;
import com.example.quizhub.entity.Attempt;
import com.example.quizhub.entity.Question;
import com.example.quizhub.entity.Quiz;
import com.example.quizhub.entity.QuizAssigning;
import com.example.quizhub.entity.QuizTaking;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.UserAttemptAnswer;
import com.example.quizhub.entity.enums.TakingStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.AnswerRepository;
import com.example.quizhub.repository.AttemptRepository;
import com.example.quizhub.repository.QuizAssigningRepository;
import com.example.quizhub.repository.QuizTakingRepository;
import com.example.quizhub.repository.UserAttemptAnswerRepository;
import com.example.quizhub.repository.QuizRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.service.NotificationService;
import com.example.quizhub.service.quiz.QuizTakingService;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.NotificationType;
import com.example.quizhub.repository.ExamViolationRepository;
import com.example.quizhub.repository.AttemptViolationRepository;
import com.example.quizhub.entity.AttemptViolation;
import com.example.quizhub.entity.ExamViolation;
import com.example.quizhub.dto.quiztaking.request.ViolationRequestDTO;
import com.example.quizhub.dto.quiztaking.request.SaveAnswerRequestDTO;
import com.example.quizhub.dto.quiztaking.response.QuizAttemptSummaryDTO;
import com.example.quizhub.dto.quiztaking.response.ViolationResponseDTO;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuizTakingServiceImpl implements QuizTakingService {
    private final UserRepository userRepository;
    private final QuizTakingRepository quizTakingRepository;
    private final AnswerRepository answerRepository;
    private final AttemptRepository attemptRepository;
    private final QuizAssigningRepository quizAssigningRepository;
    private final UserAttemptAnswerRepository userAttemptAnswerRepository;
    private final ExamViolationRepository examViolationRepository;
    private final AttemptViolationRepository attemptViolationRepository;
    private final QuizRepository quizRepository;
    private final NotificationService notificationService;
    private final com.example.quizhub.repository.ClassJoiningRepository classJoiningRepository;

    @Override
    @Transactional
    public QuizTakingResponseDTO startQuizAttempt(Long studentId, Long quizAssigningId) {
        User student = userRepository.findWithLockById(studentId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        QuizAssigning quizAssigning = quizAssigningRepository.findById(quizAssigningId)
                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_NOT_FOUND));

        validateQuizSchedule(quizAssigning);

        // Check if student is in the class
        classJoiningRepository.findByClassroomIdAndLearnerId(quizAssigning.getClassroom().getId(), studentId)
                .filter(cj -> cj.getStatus() == JoinStatus.APPROVED)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_IN_CLASS));

        Quiz quiz = quizAssigning.getQuiz();
        QuizTaking quizTaking = quizTakingRepository.findByLearnerIdAndQuizAssigningId(studentId, quizAssigningId)
                .stream().findFirst()
                .orElseGet(() -> quizTakingRepository.save(QuizTaking.builder()
                        .isAssigned(true)
                        .status(TakingStatus.NOT_STARTED)
                        .quiz(quiz)
                        .quizAssigning(quizAssigning)
                        .learner(student)
                        .build()));

        // Find existing attempts
        List<Attempt> attempts = attemptRepository.findByQuizTakingId(quizTaking.getId());

        // Find unfinished attempt to resume
        Attempt attempt = attempts.stream()
                .filter(a -> a.getEndedAt() == null)
                .findFirst()
                .orElse(null);

        if (attempt == null) {
            // Check if reached max attempts
            if (quizAssigning.getMaxAttempt() != null) {
                long finishedCount = attempts.stream()
                        .filter(a -> a.getEndedAt() != null)
                        .count();
                if (finishedCount >= quizAssigning.getMaxAttempt()) {
                    throw new AppException(ErrorCode.MAX_ATTEMPTS_REACHED);
                }
            }

            attempt = Attempt.builder()
                    .quizTaking(quizTaking)
                    .startedAt(LocalDateTime.now())
                    .totalQuestNum(quiz.getQuestions().size())
                    .build();
            attempt = attemptRepository.save(attempt);
            quizTaking.setStatus(TakingStatus.IN_PROGRESS);
            quizTakingRepository.save(quizTaking);
        }

        Random random = new Random(attempt.getId());

        // Batch fetch all answers for all questions in this quiz
        List<Long> questionIds = quiz.getQuestions().stream()
                .map(Question::getId)
                .collect(Collectors.toList());

        List<Answer> allAnswers = answerRepository.findByQuestionIdIn(questionIds);
        Map<Long, List<Answer>> answersByQuestionId = allAnswers.stream()
                .collect(Collectors.groupingBy(a -> a.getQuestion().getId()));

        List<QuestionTakingResponseDTO> questionDTOs = quiz.getQuestions().stream()
                .map(question -> {
                    List<Answer> questionAnswers = answersByQuestionId.getOrDefault(question.getId(),
                            Collections.emptyList());
                    List<AnswerTakingResponseDTO> answerDTOs = questionAnswers.stream()
                            .map(ans -> new AnswerTakingResponseDTO(
                                    ans.getId(),
                                    ans.getText()))
                            .collect(Collectors.toList());

                    if (Boolean.TRUE.equals(quizAssigning.getAnswerShuffled())) {
                        Collections.shuffle(answerDTOs, random);
                    }

                    return new QuestionTakingResponseDTO(
                            question.getId(),
                            question.getText(),
                            question.getType(),
                            question.getLevel(),
                            answerDTOs);
                })
                .collect(Collectors.toList());

        if (Boolean.TRUE.equals(quizAssigning.getQuestionShuffled())) {
            Collections.shuffle(questionDTOs, random);
        }

        // Fetch saved answers for this attempt
        List<UserAttemptAnswer> savedAnswers = userAttemptAnswerRepository.findByAttemptId(attempt.getId());

        Map<Long, List<Long>> selectedAnswers = savedAnswers.stream()
                .filter(uaa -> uaa.getAnswer() != null)
                .collect(Collectors.groupingBy(
                        uaa -> uaa.getQuestion().getId(),
                        Collectors.mapping(uaa -> uaa.getAnswer().getId(), Collectors.toList())));

        Map<Long, String> selectedTexts = savedAnswers.stream()
                .filter(uaa -> uaa.getSelectedText() != null)
                .collect(Collectors.toMap(
                        uaa -> uaa.getQuestion().getId(),
                        UserAttemptAnswer::getSelectedText,
                        (existing, replacement) -> existing));

        Map<Long, Long> answerRevisions = savedAnswers.stream()
                .filter(uaa -> uaa.getRevision() != null)
                .collect(Collectors.toMap(
                        uaa -> uaa.getQuestion().getId(),
                        UserAttemptAnswer::getRevision,
                        Math::max));

        return QuizTakingResponseDTO.builder()
                .attemptId(attempt.getId())
                .quizTitle(quiz.getTitle())
                .durationInMins(quizAssigning.getDurationInMins())
                .startedAt(attempt.getStartedAt())
                .startedAtMillis(
                        attempt.getStartedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli())
                .questions(questionDTOs)
                .selectedAnswers(selectedAnswers)
                .selectedTexts(selectedTexts)
                .answerRevisions(answerRevisions)
                .build();
    }

    @Override
    @Transactional
    public void saveAnswer(Long studentId, Long attemptId, Long questionId,
            SaveAnswerRequestDTO request) {
        // Acquire PESSIMISTIC_WRITE lock on Attempt
        Attempt attempt = attemptRepository.findWithLockById(attemptId)
                .orElseThrow(() -> new AppException(ErrorCode.ATTEMPT_NOT_FOUND));

        if (!attempt.getQuizTaking().getLearner().getId().equals(studentId)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        if (attempt.getEndedAt() != null) {
            throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);
        }

        // Check schedule if assigned
        validateQuizSchedule(attempt.getQuizTaking().getQuizAssigning());

        // Validate question/answer ownership before touching persisted state
        Quiz quiz = attempt.getQuizTaking().getQuiz();
        validateQuestionInQuiz(quiz, questionId);
        validateAnswersBelongToQuestion(questionId, request.getAnswerIds());

        Long incomingRevision = request.getRevision();
        Long latestPersistedRevision = userAttemptAnswerRepository.findMaxRevisionByAttemptIdAndQuestionId(attemptId, questionId);

        if (incomingRevision != null) {
            if (latestPersistedRevision != null && latestPersistedRevision >= incomingRevision) {
                // Stale or duplicate request - ignore safely
                return;
            }
        } else {
            // Legacy request
            if (latestPersistedRevision != null) {
                // Unversioned request cannot overwrite existing versioned state
                return;
            }
        }

        replaceQuestionState(attempt, questionId, request.getAnswerIds(), request.getSelectedText(), incomingRevision);
    }

    private void replaceQuestionState(Attempt attempt, Long questionId, List<Long> answerIds, String selectedText, Long incomingRevision) {
        userAttemptAnswerRepository.deleteByAttemptIdAndQuestionId(attempt.getId(), questionId);
        Question question = Question.builder().id(questionId).build();

        if (selectedText != null) {
            UserAttemptAnswer uaa = UserAttemptAnswer.builder()
                    .attempt(attempt)
                    .question(question)
                    .selectedText(selectedText)
                    .timestamp(LocalDateTime.now())
                    .revision(incomingRevision)
                    .build();
            userAttemptAnswerRepository.save(uaa);
        } else if (answerIds != null && !answerIds.isEmpty()) {
            // Duplicate answer IDs are normalized to distinct IDs so they cannot create
            // duplicate persisted selections that would distort grading.
            List<Long> distinctAnswerIds = answerIds.stream().distinct().collect(Collectors.toList());
            List<UserAttemptAnswer> answersToSave = new java.util.ArrayList<>();
            Map<Long, Answer> answerMap = answerRepository.findAllById(distinctAnswerIds).stream()
                    .collect(Collectors.toMap(Answer::getId, a -> a));

            for (Long answerId : distinctAnswerIds) {
                Answer answer = answerMap.get(answerId);
                if (answer == null) {
                    throw new AppException(ErrorCode.ANSWER_NOT_FOUND);
                }

                answersToSave.add(UserAttemptAnswer.builder()
                        .attempt(attempt)
                        .question(question)
                        .answer(answer)
                        .timestamp(LocalDateTime.now())
                        .revision(incomingRevision)
                        .build());
            }
            if (!answersToSave.isEmpty()) {
                userAttemptAnswerRepository.saveAll(answersToSave);
            }
        } else {
            // Tombstone for clear/deselect
            UserAttemptAnswer uaa = UserAttemptAnswer.builder()
                    .attempt(attempt)
                    .question(question)
                    .timestamp(LocalDateTime.now())
                    .revision(incomingRevision)
                    .build();
            userAttemptAnswerRepository.save(uaa);
        }
    }

    private void validateQuestionInQuiz(Quiz quiz, Long questionId) {
        if (questionId == null) {
            return;
        }
        boolean belongsToQuiz = quiz.getQuestions().stream()
                .anyMatch(q -> q.getId().equals(questionId));
        if (!belongsToQuiz) {
            throw new AppException(ErrorCode.QUESTION_NOT_IN_QUIZ);
        }
    }

    private void validateAnswersBelongToQuestion(Long questionId, List<Long> answerIds) {
        if (answerIds == null || answerIds.isEmpty()) {
            return;
        }
        List<Long> distinctAnswerIds = answerIds.stream().distinct().collect(Collectors.toList());
        Map<Long, Answer> answerMap = answerRepository.findAllById(distinctAnswerIds).stream()
                .collect(Collectors.toMap(Answer::getId, a -> a));

        for (Long answerId : distinctAnswerIds) {
            Answer answer = answerMap.get(answerId);
            if (answer == null) {
                throw new AppException(ErrorCode.ANSWER_NOT_FOUND);
            }
            if (answer.getQuestion() == null || !answer.getQuestion().getId().equals(questionId)) {
                throw new AppException(ErrorCode.ANSWER_NOT_IN_QUESTION);
            }
        }
    }

    /**
     * Validates every question/answer in a submit payload against the attempt's quiz
     * BEFORE any persisted state is mutated, so a single malformed entry in a multi-question
     * payload cannot leave a partially-applied submission. Answer ownership is checked with
     * one bulk fetch across the whole payload rather than one query per question.
     */
    private void validateSubmitPayload(Quiz quiz, List<QuestionSubmitRequestDTO> questions) {
        if (questions == null || questions.isEmpty()) {
            return;
        }
        for (QuestionSubmitRequestDTO qReq : questions) {
            validateQuestionInQuiz(quiz, qReq.getQuestionId());
        }

        java.util.Set<Long> allAnswerIds = questions.stream()
                .filter(qReq -> qReq.getAnswerIds() != null)
                .flatMap(qReq -> qReq.getAnswerIds().stream())
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        if (allAnswerIds.isEmpty()) {
            return;
        }
        Map<Long, Answer> answerMap = answerRepository.findAllById(allAnswerIds).stream()
                .collect(Collectors.toMap(Answer::getId, a -> a));

        for (QuestionSubmitRequestDTO qReq : questions) {
            if (qReq.getAnswerIds() == null || qReq.getAnswerIds().isEmpty()) {
                continue;
            }
            for (Long answerId : qReq.getAnswerIds().stream().distinct().collect(Collectors.toList())) {
                Answer answer = answerMap.get(answerId);
                if (answer == null) {
                    throw new AppException(ErrorCode.ANSWER_NOT_FOUND);
                }
                if (answer.getQuestion() == null || !answer.getQuestion().getId().equals(qReq.getQuestionId())) {
                    throw new AppException(ErrorCode.ANSWER_NOT_IN_QUESTION);
                }
            }
        }
    }

    @Override
    @Transactional
    public void autoSubmitExpiredAttempts() {
        LocalDateTime now = LocalDateTime.now();
        List<Attempt> activeAttempts = attemptRepository.findActiveAttemptsWithAssigning();

        for (Attempt attempt : activeAttempts) {
            boolean expired = false;
            QuizAssigning assigning = attempt.getQuizTaking().getQuizAssigning();

            // 1. Kiểm tra hạn chót nộp bài (DueDate)
            if (assigning.getDueDate() != null && now.isAfter(assigning.getDueDate())) {
                expired = true;
            }

            // 2. Kiểm tra thời lượng làm bài (Duration)
            if (!expired && assigning.getDurationInMins() != null) {
                // Thêm 1 phút bù trừ độ trễ mạng/hệ thống
                LocalDateTime limitTime = attempt.getStartedAt().plusMinutes(assigning.getDurationInMins())
                        .plusMinutes(1);
                if (now.isAfter(limitTime)) {
                    expired = true;
                }
            }

            if (expired) {
                log.info("Auto-submitting expired attempt ID: {}", attempt.getId());
                finalizeAttempt(attempt);
            }
        }
    }

    private void finalizeAttempt(Attempt attempt) {
        Quiz quiz = attempt.getQuizTaking().getQuiz();
        int totalQuestion = attempt.getTotalQuestNum();
        int correctCount = 0;

        // Get saved answers from DB
        List<UserAttemptAnswer> savedAnswers = userAttemptAnswerRepository.findByAttemptId(attempt.getId());
        Map<Long, List<UserAttemptAnswer>> answersMap = savedAnswers.stream()
                .collect(Collectors.groupingBy(uaa -> uaa.getQuestion().getId()));

        List<Question> questions = quiz.getQuestions();
        List<Long> questionIds = questions.stream().map(Question::getId).collect(Collectors.toList());
        Map<Long, List<Answer>> correctAnswersByQuestionId = questionIds.isEmpty() ? Collections.emptyMap() :
                answerRepository.findByQuestionIdIn(questionIds).stream()
                        .filter(Answer::getIsCorrect)
                        .collect(Collectors.groupingBy(a -> a.getQuestion().getId()));

        for (Question question : questions) {
            List<UserAttemptAnswer> userAnswers = answersMap.getOrDefault(question.getId(), Collections.emptyList());
            List<Answer> correctAnswers = correctAnswersByQuestionId.getOrDefault(question.getId(), Collections.emptyList());

            if (question.getType() == QuestionType.FILL_IN_BLANK) {
                String studentText = userAnswers.isEmpty() ? ""
                        : (userAnswers.get(0).getSelectedText() != null ? userAnswers.get(0).getSelectedText() : "");
                String trimmedStudent = studentText.trim();
                boolean isCorrect = correctAnswers.stream()
                        .anyMatch(a -> a.getText() != null && a.getText().trim().equalsIgnoreCase(trimmedStudent));
                if (isCorrect)
                    correctCount++;
            } else {
                List<Long> submitedAnswersIds = userAnswers.stream()
                        .filter(uaa -> uaa.getAnswer() != null)
                        .map(uaa -> uaa.getAnswer().getId())
                        .collect(Collectors.toList());

                List<Long> correctAnswersIds = correctAnswers.stream()
                        .map(Answer::getId)
                        .collect(Collectors.toList());

                if (!correctAnswersIds.isEmpty() && submitedAnswersIds.size() == correctAnswersIds.size()
                        && submitedAnswersIds.containsAll(correctAnswersIds)) {
                    correctCount++;
                }
            }
        }

        int incorrectCount = totalQuestion - correctCount;
        BigDecimal finalScore = BigDecimal.ZERO;
        if (totalQuestion > 0) {
            finalScore = BigDecimal.valueOf((double) correctCount / totalQuestion * 10.0)
                    .setScale(2, RoundingMode.HALF_UP);
        }

        attempt.setResult(finalScore);
        attempt.setCorrectNum(correctCount);
        attempt.setIncorrectNum(incorrectCount);
        attempt.setEndedAt(LocalDateTime.now());
        attempt.getQuizTaking().setStatus(TakingStatus.COMPLETED);
        quizTakingRepository.save(attempt.getQuizTaking());
        attemptRepository.save(attempt);

        // Notify student of result
        try {
            notificationService.createNotification(
                    attempt.getQuizTaking().getLearner().getId(),
                    "Kết quả bài thi: " + quiz.getTitle(),
                    "Bạn đã hoàn thành bài thi với số điểm: " + finalScore + "/10",
                    NotificationType.QUIZ_SUBMITTED,
                    "/student/history");
        } catch (Exception e) {
        }
    }

    @Override
    @Transactional
    public Attempt submitQuizAttempt(Long studentId, QuizSubmitRequestDTO requestDTO) {
        Attempt attempt = attemptRepository.findWithLockById(requestDTO.getAttemptId())
                .orElseThrow(() -> new AppException(ErrorCode.ATTEMPT_NOT_FOUND));

        if (studentId != null) {
            User user = userRepository.findById(studentId).orElse(null);
            if (user != null && user.getRole() == Role.STUDENT) {
                if (!attempt.getQuizTaking().getLearner().getId().equals(studentId)) {
                    throw new AppException(ErrorCode.UNAUTHORIZED);
                }
            }
        }

        if (attempt.getEndedAt() != null) {
            return attempt;
        }

        // Check schedule if assigned
        try {
            validateQuizSchedule(attempt.getQuizTaking().getQuizAssigning());
        } catch (AppException e) {
            if (e.getErrorCode() == ErrorCode.QUIZ_EXPIRED || e.getErrorCode() == ErrorCode.QUIZ_ASSIGNING_NOT_FOUND) {
                // If the teacher closed the quiz or hid it, auto-submit whatever is in the DB
                finalizeAttempt(attempt);
                return attempt;
            } else {
                throw e;
            }
        }

        if (requestDTO.getQuestions() != null) {
            // Validate the entire payload's question/answer ownership up front so a single
            // malformed entry cannot leave a partially-applied submission.
            validateSubmitPayload(attempt.getQuizTaking().getQuiz(), requestDTO.getQuestions());

            for (QuestionSubmitRequestDTO qReq : requestDTO.getQuestions()) {
                Long questionId = qReq.getQuestionId();
                Long incomingRevision = qReq.getRevision();
                Long latestPersistedRevision = userAttemptAnswerRepository.findMaxRevisionByAttemptIdAndQuestionId(attempt.getId(), questionId);

                boolean shouldApply = false;
                if (incomingRevision != null) {
                    if (latestPersistedRevision == null || incomingRevision > latestPersistedRevision) {
                        shouldApply = true;
                    }
                } else {
                    if (latestPersistedRevision == null) {
                        shouldApply = true;
                    }
                }

                if (shouldApply) {
                    replaceQuestionState(attempt, questionId, qReq.getAnswerIds(), qReq.getSelectedText(), incomingRevision);
                }
            }
        }

        userAttemptAnswerRepository.flush();
        finalizeAttempt(attempt);
        return attempt;
    }

    @Override
    public QuizResultResponseDTO getQuizResult(Long studentId, Long attemptId) {
        Attempt attempt = getValidAttempt(attemptId, studentId);

        Quiz quiz = attempt.getQuizTaking().getQuiz();
        QuizAssigning quizAssigning = attempt.getQuizTaking().getQuizAssigning();

        boolean isTeacherOrAdmin = false;
        if (studentId != null) {
            User user = userRepository.findById(studentId).orElse(null);
            if (user != null && (user.getRole() == Role.TEACHER || user.getRole() == Role.ADMIN)) {
                isTeacherOrAdmin = true;
            }
        }

        // Show answers if:
        // 1. Requester is a teacher or admin
        // 2. OR It's a personal quiz (no assigning)
        // 3. OR the teacher explicitly allowed it (showAnswer is true)
        // 4. OR the deadline has passed (safety fallback, though usually showAnswer is
        // the master switch)
        boolean deadlinePassed = quizAssigning == null || quizAssigning.getDueDate() == null
                || quizAssigning.getDueDate().isBefore(LocalDateTime.now());

        boolean shouldShowAnswer = isTeacherOrAdmin
                || quizAssigning == null
                || Boolean.TRUE.equals(quizAssigning.getShowAnswer())
                || deadlinePassed;

        List<UserAttemptAnswer> userAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);

        // Map questionId -> list of selected answerIds
        Map<Long, List<Long>> selectedAnswersMap = userAnswers.stream()
                .filter(ua -> ua.getAnswer() != null)
                .collect(Collectors.groupingBy(
                        ua -> ua.getQuestion().getId(),
                        Collectors.mapping(ua -> ua.getAnswer().getId(), Collectors.toList())));

        // Map questionId -> selected free-text answer, built once instead of re-scanning
        // userAnswers per question (was an O(Q^2) scan for FILL_IN_BLANK-heavy quizzes).
        Map<Long, String> selectedTextMap = userAnswers.stream()
                .filter(ua -> ua.getSelectedText() != null)
                .collect(Collectors.toMap(
                        ua -> ua.getQuestion().getId(),
                        UserAttemptAnswer::getSelectedText,
                        (existing, replacement) -> existing));

        // Bulk fetch all answers for all questions in this quiz in a single query, instead of
        // relying on Question.answers' batched lazy-load (which scales the number of _answer
        // queries with the question count).
        List<Long> questionIds = quiz.getQuestions().stream().map(Question::getId).collect(Collectors.toList());
        Map<Long, List<Answer>> answersByQuestionId = questionIds.isEmpty() ? Collections.emptyMap() :
                answerRepository.findByQuestionIdIn(questionIds).stream()
                        .collect(Collectors.groupingBy(a -> a.getQuestion().getId()));

        QuizAssigning assigning = attempt.getQuizTaking().getQuizAssigning();
        Random random = new Random(attempt.getId());

        List<QuizResultResponseDTO.QuestionResultDTO> questionResults = quiz.getQuestions().stream()
                .map(q -> {
                    List<Answer> questionAnswers = answersByQuestionId.getOrDefault(q.getId(), Collections.emptyList());
                    List<Long> selectedIds = selectedAnswersMap.getOrDefault(q.getId(), Collections.emptyList());
                    String selectedText = selectedTextMap.get(q.getId());

                    boolean isCorrect = false;
                    if (q.getType() == QuestionType.FILL_IN_BLANK) {
                        String trimmedStudent = (selectedText != null ? selectedText : "").trim();
                        isCorrect = questionAnswers.stream()
                                .filter(Answer::getIsCorrect)
                                .anyMatch(a -> a.getText() != null
                                        && a.getText().trim().equalsIgnoreCase(trimmedStudent));
                    } else {
                        List<Long> correctIds = questionAnswers.stream()
                                .filter(Answer::getIsCorrect)
                                .map(Answer::getId)
                                .collect(Collectors.toList());
                        isCorrect = selectedIds.size() == correctIds.size() && selectedIds.containsAll(correctIds);
                    }

                    List<QuizResultResponseDTO.AnswerResultDTO> answerResults = questionAnswers.stream()
                            .map(a -> QuizResultResponseDTO.AnswerResultDTO.builder()
                                    .answerId(a.getId())
                                    .text(a.getText())
                                    .isCorrect(shouldShowAnswer ? a.getIsCorrect() : null)
                                    .build())
                            .collect(Collectors.toList());

                    // Shuffle answers if needed
                    if (assigning != null && Boolean.TRUE.equals(assigning.getAnswerShuffled())) {
                        Collections.shuffle(answerResults, random);
                    }

                    return QuizResultResponseDTO.QuestionResultDTO.builder()
                            .questionId(q.getId())
                            .text(q.getText())
                            .type(q.getType().name())
                            .level(q.getLevel() != null ? q.getLevel().name() : "MEDIUM")
                            .answers(answerResults)
                            .selectedAnswerIds(selectedIds)
                            .selectedText(selectedText)
                            .isCorrect(shouldShowAnswer ? isCorrect : null)
                            .build();
                })
                .collect(Collectors.toList());

        // Shuffle questions if needed
        if (assigning != null && Boolean.TRUE.equals(assigning.getQuestionShuffled())) {
            Collections.shuffle(questionResults, random);
        }

        return QuizResultResponseDTO.builder()
                .attemptId(attempt.getId())
                .quizTitle(quiz.getTitle())
                .score(attempt.getResult())
                .correctNum(shouldShowAnswer ? attempt.getCorrectNum() : null)
                .incorrectNum(shouldShowAnswer ? attempt.getIncorrectNum() : null)
                .totalNum(attempt.getTotalQuestNum())
                .startedAt(attempt.getStartedAt())
                .endedAt(attempt.getEndedAt())
                .questions(shouldShowAnswer ? questionResults : Collections.emptyList())
                .build();
    }

    @Override
    @Transactional
    public ViolationResponseDTO recordViolation(Long studentId, ViolationRequestDTO request) {
        Attempt attempt = getValidAttempt(request.getAttemptId(), studentId);

        // Nếu bài đã nộp rồi thì bỏ qua, trả về state hiện tại
        if (attempt.getEndedAt() != null) {
            long count = attemptViolationRepository.countByAttemptId(attempt.getId());
            return ViolationResponseDTO.builder()
                    .violationCount(count)
                    .autoSubmitted(false)
                    .attemptId(attempt.getId())
                    .build();
        }

        ExamViolation violationType = examViolationRepository.findByViolationCode(request.getViolationCode())
                .orElseGet(() -> ExamViolation.builder().violationCode(request.getViolationCode()).build());

        // Cập nhật hoặc thiết lập mức độ và mô tả đúng chuẩn
        int severity = 1;
        String desc = violationType.getDescription() != null ? violationType.getDescription()
                : "Vi phạm: " + request.getViolationCode();

        switch (request.getViolationCode()) {
            case "FULLSCREEN_EXIT":
            case "TAB_CLOSE":
                severity = 3; // Nghiêm trọng
                desc = (request.getViolationCode().equals("FULLSCREEN_EXIT")) ? "Thoát Toàn màn hình"
                        : "Đóng trình duyệt";
                break;
            case "TAB_SWITCH":
                severity = 2; // Cảnh cáo
                desc = "Chuyển Tab trình duyệt";
                break;
            case "WINDOW_BLUR":
                severity = 1; // Nhẹ
                desc = "Rời cửa sổ làm bài";
                break;
        }

        // Nếu thông tin cũ khác với thông tin chuẩn mới, hãy cập nhật lại
        if (violationType.getSeverityLevel() == null || violationType.getSeverityLevel() != severity) {
            violationType.setSeverityLevel(severity);
            violationType.setDescription(desc);
            examViolationRepository.save(violationType);
        }

        AttemptViolation violation = AttemptViolation.builder()
                .attempt(attempt)
                .violationType(violationType)
                .occurredAt(LocalDateTime.now())
                .build();

        attemptViolationRepository.save(violation);

        // Đếm tổng vi phạm sau khi vừa ghi nhận
        long totalViolations = attemptViolationRepository.countByAttemptId(attempt.getId());

        // Nếu >= 3 vi phạm thì auto-submit bài thi
        if (totalViolations >= 3) {
            log.warn("Auto-submitting attempt ID={} do vượt ngưỡng vi phạm ({} lần)", attempt.getId(), totalViolations);
            finalizeAttempt(attempt);
            // Gửi thêm thông báo cảnh báo vi phạm
            try {
                notificationService.createNotification(
                        attempt.getQuizTaking().getLearner().getId(),
                        "Bài thi bị nộp tự động",
                        "Bài thi \"" + attempt.getQuizTaking().getQuiz().getTitle()
                                + "\" đã bị nộp tự động vì bạn vi phạm " + totalViolations + " lần.",
                        NotificationType.SYSTEM_ALERT,
                        "/student/history");
            } catch (Exception e) {
                log.error("Gửi thông báo auto-submit thất bại", e);
            }
            return ViolationResponseDTO.builder()
                    .violationCount(totalViolations)
                    .autoSubmitted(true)
                    .attemptId(attempt.getId())
                    .build();
        }

        return ViolationResponseDTO.builder()
                .violationCount(totalViolations)
                .autoSubmitted(false)
                .attemptId(attempt.getId())
                .build();
    }

    @Override
    @Transactional
    public QuizTakingResponseDTO startPersonalQuizAttempt(Long studentId, String quizId) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        Quiz quiz = quizRepository.findById(UUID.fromString(quizId))
                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_NOT_FOUND));

        QuizTaking quizTaking = quizTakingRepository
                .findByLearnerIdAndQuizIdAndIsAssignedFalse(studentId, UUID.fromString(quizId))
                .stream().findFirst()
                .orElseGet(() -> quizTakingRepository.save(QuizTaking.builder()
                        .isAssigned(false)
                        .status(TakingStatus.NOT_STARTED)
                        .quiz(quiz)
                        .learner(student)
                        .build()));

        List<Attempt> attempts = attemptRepository.findByQuizTakingId(quizTaking.getId());
        Attempt attempt = attempts.stream()
                .filter(a -> a.getEndedAt() == null)
                .findFirst()
                .orElse(null);

        if (attempt == null) {
            attempt = Attempt.builder()
                    .quizTaking(quizTaking)
                    .startedAt(LocalDateTime.now())
                    .totalQuestNum(quiz.getQuestions().size())
                    .build();
            attempt = attemptRepository.save(attempt);
            quizTaking.setStatus(TakingStatus.IN_PROGRESS);
            quizTakingRepository.save(quizTaking);
        }

        return buildQuizTakingResponseDTO(attempt, quiz, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<QuizAttemptSummaryDTO> getQuizAttempts(Long studentId,
            String quizId) {
        QuizTaking quizTaking = quizTakingRepository
                .findByLearnerIdAndQuizIdAndIsAssignedFalse(studentId, UUID.fromString(quizId))
                .stream().findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_NOT_FOUND));

        return attemptRepository.findByQuizTakingId(quizTaking.getId()).stream()
                .filter(a -> a.getEndedAt() != null)
                .map(a -> QuizAttemptSummaryDTO.builder()
                        .id(a.getId())
                        .result(a.getResult())
                        .totalQuestNum(a.getTotalQuestNum())
                        .correctNum(a.getCorrectNum())
                        .incorrectNum(a.getIncorrectNum())
                        .startedAt(a.getStartedAt())
                        .endedAt(a.getEndedAt())
                        .build())
                .sorted((a1, a2) -> a2.getStartedAt().compareTo(a1.getStartedAt()))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public QuizTakingResponseDTO getQuizTakingState(Long studentId, Long attemptId) {
        Attempt attempt = getValidAttempt(attemptId, studentId);

        QuizTaking quizTaking = attempt.getQuizTaking();
        Quiz quiz = quizTaking.getQuiz();
        QuizAssigning quizAssigning = quizTaking.getQuizAssigning();

        // Check schedule if assigned
        validateQuizSchedule(quizAssigning);

        return buildQuizTakingResponseDTO(attempt, quiz, quizAssigning);
    }

    private QuizTakingResponseDTO buildQuizTakingResponseDTO(Attempt attempt, Quiz quiz, QuizAssigning quizAssigning) {
        Random random = new Random(attempt.getId());

        List<Question> questions = quiz.getQuestions();
        List<Long> questionIds = questions.stream()
                .map(Question::getId)
                .collect(Collectors.toList());

        Map<Long, List<Answer>> answersByQuestionId = questionIds.isEmpty() ? 
            Collections.emptyMap() : 
            answerRepository.findByQuestionIdIn(questionIds)
                .stream()
                .collect(Collectors.groupingBy(ans -> ans.getQuestion().getId()));

        List<QuestionTakingResponseDTO> questionDTOs = questions.stream()
                .map(question -> {
                    List<Answer> questionAnswers = answersByQuestionId.getOrDefault(question.getId(), Collections.emptyList());
                    List<AnswerTakingResponseDTO> answerDTOs = questionAnswers.stream()
                            .map(ans -> new AnswerTakingResponseDTO(
                                    ans.getId(),
                                    ans.getText()))
                            .collect(Collectors.toList());

                    if (quizAssigning != null && Boolean.TRUE.equals(quizAssigning.getAnswerShuffled())) {
                        Collections.shuffle(answerDTOs, random);
                    }

                    return new QuestionTakingResponseDTO(
                            question.getId(),
                            question.getText(),
                            question.getType(),
                            question.getLevel(),
                            answerDTOs);
                })
                .collect(Collectors.toList());

        if (quizAssigning != null && Boolean.TRUE.equals(quizAssigning.getQuestionShuffled())) {
            Collections.shuffle(questionDTOs, random);
        }

        // Fetch saved answers for this attempt
        List<UserAttemptAnswer> savedAnswers = userAttemptAnswerRepository.findByAttemptId(attempt.getId());

        Map<Long, List<Long>> selectedAnswers = savedAnswers
                .stream()
                .filter(uaa -> uaa.getAnswer() != null)
                .collect(Collectors.groupingBy(
                        uaa -> uaa.getQuestion().getId(),
                        Collectors.mapping(uaa -> uaa.getAnswer().getId(), Collectors.toList())));

        Map<Long, String> selectedTexts = savedAnswers
                .stream()
                .filter(uaa -> uaa.getSelectedText() != null && !uaa.getSelectedText().trim().isEmpty())
                .collect(Collectors.toMap(
                        uaa -> uaa.getQuestion().getId(),
                        UserAttemptAnswer::getSelectedText,
                        (existing, replacement) -> existing));

        Map<Long, Long> answerRevisions = savedAnswers.stream()
                .filter(uaa -> uaa.getRevision() != null)
                .collect(Collectors.toMap(
                        uaa -> uaa.getQuestion().getId(),
                        UserAttemptAnswer::getRevision,
                        Math::max));

        return QuizTakingResponseDTO.builder()
                .attemptId(attempt.getId())
                .quizTitle(quiz.getTitle())
                .durationInMins(quizAssigning != null ? quizAssigning.getDurationInMins() : null)
                .startedAt(attempt.getStartedAt())
                .questions(questionDTOs)
                .selectedAnswers(selectedAnswers)
                .selectedTexts(selectedTexts)
                .answerRevisions(answerRevisions)
                .build();
    }

    private void validateQuizSchedule(QuizAssigning quizAssigning) {
        if (quizAssigning != null) {
            if (Boolean.TRUE.equals(quizAssigning.getIsHidden())) {
                throw new AppException(ErrorCode.QUIZ_ASSIGNING_NOT_FOUND);
            }
            LocalDateTime now = LocalDateTime.now();
            if (quizAssigning.getStartDate() != null && now.isBefore(quizAssigning.getStartDate())) {
                throw new AppException(ErrorCode.QUIZ_NOT_STARTED);
            }
            if (quizAssigning.getDueDate() != null && now.isAfter(quizAssigning.getDueDate())) {
                throw new AppException(ErrorCode.QUIZ_EXPIRED);
            }
        }
    }

    private Attempt getValidAttempt(Long attemptId, Long userId) {
        Attempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new AppException(ErrorCode.ATTEMPT_NOT_FOUND));

        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                if (user.getRole() == Role.STUDENT) {
                    if (!attempt.getQuizTaking().getLearner().getId().equals(userId)) {
                        throw new AppException(ErrorCode.UNAUTHORIZED);
                    }
                    // TEACHER or ADMIN are allowed to view the attempt details
                }
            }
        }
        return attempt;
    }
}
    
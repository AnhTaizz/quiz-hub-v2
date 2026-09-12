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
        User student = userRepository.findById(studentId)
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
                .build();
    }

    @Override
    @Transactional
    public void saveAnswer(Long studentId, Long attemptId, Long questionId,
            SaveAnswerRequestDTO request) {
        Attempt attempt = getValidAttempt(attemptId, studentId);

        if (attempt.getEndedAt() != null) {
            throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);
        }

        // Check schedule if assigned
        validateQuizSchedule(attempt.getQuizTaking().getQuizAssigning());

        // Remove old answers for this question in this attempt
        userAttemptAnswerRepository.deleteByAttemptIdAndQuestionId(attemptId, questionId);

        Question question = Question.builder().id(questionId).build();

        if (request.getSelectedText() != null) {
            UserAttemptAnswer uaa = UserAttemptAnswer.builder()
                    .attempt(attempt)
                    .question(question)
                    .selectedText(request.getSelectedText())
                    .timestamp(LocalDateTime.now())
                    .build();
            userAttemptAnswerRepository.save(uaa);
        } else if (request.getAnswerIds() != null && !request.getAnswerIds().isEmpty()) {
            List<UserAttemptAnswer> answersToSave = new java.util.ArrayList<>();
            Map<Long, Answer> answerMap = answerRepository.findAllById(request.getAnswerIds()).stream()
                    .collect(Collectors.toMap(Answer::getId, a -> a));

            for (Long answerId : request.getAnswerIds()) {
                Answer answer = answerMap.get(answerId);
                if (answer == null) {
                    throw new AppException(ErrorCode.ANSWER_NOT_FOUND);
                }

                answersToSave.add(UserAttemptAnswer.builder()
                        .attempt(attempt)
                        .question(question)
                        .answer(answer)
                        .timestamp(LocalDateTime.now())
                        .build());
            }
            if (!answersToSave.isEmpty()) {
                userAttemptAnswerRepository.saveAll(answersToSave);
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

        for (Question question : quiz.getQuestions()) {
            List<UserAttemptAnswer> userAnswers = answersMap.getOrDefault(question.getId(), Collections.emptyList());

            if (question.getType() == QuestionType.FILL_IN_BLANK) {
                String studentText = userAnswers.isEmpty() ? ""
                        : (userAnswers.get(0).getSelectedText() != null ? userAnswers.get(0).getSelectedText() : "");
                String trimmedStudent = studentText.trim();
                boolean isCorrect = question.getAnswers().stream()
                        .filter(Answer::getIsCorrect)
                        .anyMatch(a -> a.getText() != null && a.getText().trim().equalsIgnoreCase(trimmedStudent));
                if (isCorrect)
                    correctCount++;
            } else {
                List<Long> submitedAnswersIds = userAnswers.stream()
                        .filter(uaa -> uaa.getAnswer() != null)
                        .map(uaa -> uaa.getAnswer().getId())
                        .collect(Collectors.toList());

                List<Long> correctAnswersIds = question.getAnswers().stream()
                        .filter(Answer::getIsCorrect)
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
        Attempt attempt = getValidAttempt(requestDTO.getAttemptId(), studentId);

        if (attempt.getEndedAt() != null) {
            throw new AppException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);
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

        Quiz quiz = attempt.getQuizTaking().getQuiz();
        int totalQuestion = attempt.getTotalQuestNum();
        int correctCount = 0;

        // Map Id câu hỏi và DTO của học sinh
        Map<Long, QuestionSubmitRequestDTO> submittedAnswersMap = requestDTO.getQuestions().stream()
                .collect(Collectors.toMap(
                        QuestionSubmitRequestDTO::getQuestionId,
                        q -> q,
                        (existing, replacement) -> existing));

        userAttemptAnswerRepository.deleteByAttemptId(attempt.getId());
        List<UserAttemptAnswer> answersToSave = new java.util.ArrayList<>();

        List<Long> allSubmittedAnswerIds = new java.util.ArrayList<>();
        if (requestDTO.getQuestions() != null) {
            for (QuestionSubmitRequestDTO qReq : requestDTO.getQuestions()) {
                if (qReq.getAnswerIds() != null) {
                    allSubmittedAnswerIds.addAll(qReq.getAnswerIds());
                }
            }
        }
        Map<Long, Answer> answerMap = answerRepository.findAllById(allSubmittedAnswerIds).stream()
                .collect(Collectors.toMap(Answer::getId, a -> a));

        // Chấm điểm từng câu
        for (Question question : quiz.getQuestions()) {
            QuestionSubmitRequestDTO qReq = submittedAnswersMap.get(question.getId());

            if (question.getType() == QuestionType.FILL_IN_BLANK) {
                String studentText = (qReq != null && qReq.getSelectedText() != null ? qReq.getSelectedText() : "");
                String trimmedStudent = studentText.trim();
                boolean isCorrect = question.getAnswers().stream()
                        .filter(Answer::getIsCorrect)
                        .anyMatch(a -> a.getText() != null && a.getText().trim().equalsIgnoreCase(trimmedStudent));

                if (isCorrect)
                    correctCount++;

                answersToSave.add(UserAttemptAnswer.builder()
                        .attempt(attempt)
                        .question(question)
                        .selectedText(studentText)
                        .timestamp(LocalDateTime.now())
                        .build());
            } else {
                List<Long> submitedAnswersIds = (qReq != null && qReq.getAnswerIds() != null) ? qReq.getAnswerIds()
                        : Collections.emptyList();
                List<Long> correctAnswersIds = question.getAnswers().stream()
                        .filter(Answer::getIsCorrect)
                        .map(Answer::getId)
                        .collect(Collectors.toList());

                if (submitedAnswersIds.size() == correctAnswersIds.size()
                        && submitedAnswersIds.containsAll(correctAnswersIds)) {
                    correctCount++;
                }

                for (Long answerId : submitedAnswersIds) {
                    Answer answer = answerMap.get(answerId);
                    if (answer == null) {
                        throw new AppException(ErrorCode.ANSWER_NOT_FOUND);
                    }

                    answersToSave.add(UserAttemptAnswer.builder()
                            .attempt(attempt)
                            .question(question)
                            .answer(answer)
                            .timestamp(LocalDateTime.now())
                            .build());
                }
            }
        }

        if (!answersToSave.isEmpty()) {
            userAttemptAnswerRepository.saveAll(answersToSave);
        }

        // Tính điểm
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

        attemptRepository.save(attempt);

        // Notify student of result
        try {
            notificationService.createNotification(
                    studentId,
                    "Kết quả bài thi: " + quiz.getTitle(),
                    "Bạn đã hoàn thành bài thi với số điểm: " + finalScore + "/10",
                    NotificationType.QUIZ_SUBMITTED,
                    "/student/history");
        } catch (Exception e) {
        }

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

        QuizAssigning assigning = attempt.getQuizTaking().getQuizAssigning();
        Random random = new Random(attempt.getId());

        List<QuizResultResponseDTO.QuestionResultDTO> questionResults = quiz.getQuestions().stream()
                .map(q -> {
                    List<Long> selectedIds = selectedAnswersMap.getOrDefault(q.getId(), Collections.emptyList());
                    String selectedText = userAnswers.stream()
                            .filter(ua -> ua.getQuestion().getId().equals(q.getId()) && ua.getSelectedText() != null)
                            .map(UserAttemptAnswer::getSelectedText)
                            .findFirst().orElse(null);

                    boolean isCorrect = false;
                    if (q.getType() == QuestionType.FILL_IN_BLANK) {
                        String trimmedStudent = (selectedText != null ? selectedText : "").trim();
                        isCorrect = q.getAnswers().stream()
                                .filter(Answer::getIsCorrect)
                                .anyMatch(a -> a.getText() != null
                                        && a.getText().trim().equalsIgnoreCase(trimmedStudent));
                    } else {
                        List<Long> correctIds = q.getAnswers().stream()
                                .filter(Answer::getIsCorrect)
                                .map(Answer::getId)
                                .collect(Collectors.toList());
                        isCorrect = selectedIds.size() == correctIds.size() && selectedIds.containsAll(correctIds);
                    }

                    List<QuizResultResponseDTO.AnswerResultDTO> answerResults = q.getAnswers().stream()
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
    public ViolationResponseDTO recordViolation(ViolationRequestDTO request) {
        Attempt attempt = getValidAttempt(request.getAttemptId(), null);

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

        List<QuestionTakingResponseDTO> questionDTOs = quiz.getQuestions().stream()
                .map(question -> {
                    List<AnswerTakingResponseDTO> answerDTOs = question.getAnswers().stream()
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
        Map<Long, List<Long>> selectedAnswers = userAttemptAnswerRepository.findByAttemptId(attempt.getId())
                .stream()
                .filter(uaa -> uaa.getAnswer() != null)
                .collect(Collectors.groupingBy(
                        uaa -> uaa.getQuestion().getId(),
                        Collectors.mapping(uaa -> uaa.getAnswer().getId(), Collectors.toList())));

        Map<Long, String> selectedTexts = userAttemptAnswerRepository.findByAttemptId(attempt.getId())
                .stream()
                .filter(uaa -> uaa.getSelectedText() != null && !uaa.getSelectedText().trim().isEmpty())
                .collect(Collectors.toMap(
                        uaa -> uaa.getQuestion().getId(),
                        UserAttemptAnswer::getSelectedText,
                        (existing, replacement) -> existing));

        return QuizTakingResponseDTO.builder()
                .attemptId(attempt.getId())
                .quizTitle(quiz.getTitle())
                .durationInMins(quizAssigning != null ? quizAssigning.getDurationInMins() : null)
                .startedAt(attempt.getStartedAt())
                .questions(questionDTOs)
                .selectedAnswers(selectedAnswers)
                .selectedTexts(selectedTexts)
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
    
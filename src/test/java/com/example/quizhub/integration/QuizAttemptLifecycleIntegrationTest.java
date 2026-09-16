package com.example.quizhub.integration;

import java.math.BigDecimal;

import com.example.quizhub.dto.quiztaking.request.QuestionSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.request.QuizSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.request.SaveAnswerRequestDTO;
import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.entity.enums.TakingStatus;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.quiz.QuizTakingService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class QuizAttemptLifecycleIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired
    private QuizTakingService quizTakingService;

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ClassroomRepository classroomRepository;
    @Autowired
    private ClassJoiningRepository classJoiningRepository;
    @Autowired
    private QuizRepository quizRepository;
    @Autowired
    private QuestionRepository questionRepository;
    @Autowired
    private AnswerRepository answerRepository;
    @Autowired
    private QuizAssigningRepository quizAssigningRepository;
    @Autowired
    private AttemptRepository attemptRepository;
    @Autowired
    private QuizTakingRepository quizTakingRepository;
    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Autowired
    private UserAttemptAnswerRepository userAttemptAnswerRepository;

    private User studentA;
    private User studentB;
    private QuizAssigning assignedQuiz;
    private Question singleChoiceQuestion;
    private Answer answerOptionA;
    private Answer answerOptionB;

    @BeforeEach
    void setupTestFixture() {
        // Clear tables to ensure isolated testing
        userAttemptAnswerRepository.deleteAllInBatch();
        attemptRepository.deleteAllInBatch();
        quizTakingRepository.deleteAllInBatch();
        quizAssigningRepository.deleteAllInBatch();
        answerRepository.deleteAllInBatch();
        jdbcTemplate.execute("DELETE FROM _question_creating");
        jdbcTemplate.execute("DELETE FROM notifications");
        questionRepository.deleteAllInBatch();
        quizRepository.deleteAllInBatch();
        classJoiningRepository.deleteAllInBatch();
        classroomRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        // 1. Create Teacher and Students
        User teacher = userRepository.save(User.builder()
                .email("teacher@test.com")
                .password("hashedpw")
                .fullName("TFirst TLast")
                .isEnable(true)
                .isVerified(true)
                .role(Role.TEACHER).build());

        studentA = userRepository.save(User.builder()
                .email("studentA@test.com")
                .password("hashedpw")
                .fullName("AFirst ALast")
                .isEnable(true)
                .isVerified(true)
                .role(Role.STUDENT).build());

        studentB = userRepository.save(User.builder()
                .email("studentB@test.com")
                .password("hashedpw")
                .fullName("BFirst BLast")
                .isEnable(true)
                .isVerified(true)
                .role(Role.STUDENT).build());

        // 2. Create Classroom & approved membership for Student A
        Classroom classroom = classroomRepository.save(Classroom.builder()
                .name("Integration Test Class")
                .creator(teacher)
                .code("CODE123")
                .isEnable(true)
                .build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom)
                .learner(studentA)
                .status(JoinStatus.APPROVED)
                .build());

        // 3. Create Quiz with 1 Question and 2 Answers
        Quiz quiz = quizRepository.save(Quiz.builder()
                .title("Lifecycle Quiz")
                .description("Testing attempt lifecycle")
                .creator(teacher)
                .isDraft(false)
                .isEnable(true)
                .isExam(false)
                .build());

        singleChoiceQuestion = questionRepository.save(Question.builder()
                .text("What is 1 + 1?")
                .type(QuestionType.SINGLE_CHOICE)
                .build());

        quiz.setQuestions(List.of(singleChoiceQuestion));
        quizRepository.save(quiz);

        // Option A is correct
        answerOptionA = answerRepository.save(Answer.builder()
                .question(singleChoiceQuestion)
                .text("2")
                .isCorrect(true)
                .build());

        // Option B is incorrect
        answerOptionB = answerRepository.save(Answer.builder()
                .question(singleChoiceQuestion)
                .text("3")
                .isCorrect(false)
                .build());

        // 4. Assign the Quiz to the Classroom
        assignedQuiz = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz)
                .classroom(classroom)
                .durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false)
                .build());
    }

    @Test
    void startRejectsWhenMaxAttemptsReached() {
        assignedQuiz.setMaxAttempt(1);
        quizAssigningRepository.save(assignedQuiz);

        // First attempt (allowed)
        QuizTakingResponseDTO response = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        
        // Complete the attempt manually
        Attempt attempt = attemptRepository.findById(response.getAttemptId()).orElseThrow();
        attempt.setEndedAt(LocalDateTime.now());
        attemptRepository.save(attempt);

        QuizTaking taking = quizTakingRepository.findByLearnerIdAndQuizAssigningId(studentA.getId(), assignedQuiz.getId()).orElseThrow();
        taking.setStatus(TakingStatus.COMPLETED);
        quizTakingRepository.save(taking);

        // Second attempt (rejected because max attempt = 1)
        long activeAttemptsBefore = attemptRepository.count();
        
        AppException exception = assertThrows(AppException.class, 
            () -> quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId()));
            
        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.MAX_ATTEMPTS_REACHED);
        
        // Assert no new active attempt was created
        assertThat(attemptRepository.count()).isEqualTo(activeAttemptsBefore);
    }

    @Test
    void startCreatesActiveAttempt() {
        // [TEST A] - Start creates an active attempt
        QuizTakingResponseDTO response = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());

        assertThat(response).isNotNull();
        assertThat(response.getAttemptId()).isNotNull();
        
        QuizTaking taking = quizTakingRepository.findByLearnerIdAndQuizAssigningId(studentA.getId(), assignedQuiz.getId()).orElseThrow();
        assertThat(taking.getStatus()).isEqualTo(TakingStatus.IN_PROGRESS);

        List<Attempt> attempts = attemptRepository.findByQuizTakingId(taking.getId());
        assertThat(attempts).hasSize(1);
        Attempt attempt = attempts.get(0);
        assertThat(attempt.getId()).isEqualTo(response.getAttemptId());
        assertThat(attempt.getStartedAt()).isNotNull();
        assertThat(attempt.getEndedAt()).isNull();
    }

    @Test
    void startResumesExistingUnfinishedAttempt() {
        // [TEST B] - Start resumes existing unfinished attempt
        QuizTakingResponseDTO response1 = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        QuizTakingResponseDTO response2 = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());

        assertThat(response1.getAttemptId()).isEqualTo(response2.getAttemptId());

        QuizTaking taking = quizTakingRepository.findByLearnerIdAndQuizAssigningId(studentA.getId(), assignedQuiz.getId()).orElseThrow();
        List<Attempt> attempts = attemptRepository.findByQuizTakingId(taking.getId());
        
        // No duplicate attempts created
        assertThat(attempts).hasSize(1);
    }

    @Test
    void sequentialSaveReplacesSameQuestionAnswer() {
        // [TEST C] - Sequential save replaces same-question answer
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        // Save Option A
        SaveAnswerRequestDTO saveReq1 = new SaveAnswerRequestDTO();
        saveReq1.setAnswerIds(List.of(answerOptionA.getId()));
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), saveReq1);

        // Save Option B
        SaveAnswerRequestDTO saveReq2 = new SaveAnswerRequestDTO();
        saveReq2.setAnswerIds(List.of(answerOptionB.getId()));
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), saveReq2);

        // Assert only Option B remains
        List<UserAttemptAnswer> answers = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).hasSize(1);
        assertThat(answers.get(0).getAnswer().getId()).isEqualTo(answerOptionB.getId());
    }

    @Test
    void savedAnswerIsRestoredOnResumeStateRead() {
        // [TEST D] - Saved answer is restored on resume/state read
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO saveReq = new SaveAnswerRequestDTO();
        saveReq.setAnswerIds(List.of(answerOptionA.getId()));
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), saveReq);

        QuizTakingResponseDTO stateRes = quizTakingService.getQuizTakingState(studentA.getId(), attemptId);
        
        assertThat(stateRes.getSelectedAnswers()).containsKey(singleChoiceQuestion.getId());
        List<Long> selectedAnswerIds = stateRes.getSelectedAnswers().get(singleChoiceQuestion.getId());
        assertThat(selectedAnswerIds).containsExactly(answerOptionA.getId());
    }

    @Test
    void submitFinalizesAttempt() {
        // [TEST E] - Submit finalizes attempt
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId()));

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        // Reload attempt from repository to prove database persistence
        Attempt submittedAttempt = attemptRepository.findById(attemptId).orElseThrow();

        assertThat(submittedAttempt.getEndedAt()).isNotNull();
        // Given 1 question and we chose the correct answer, score should be 10.0, 1 correct, 0 incorrect
        assertThat(submittedAttempt.getResult().doubleValue()).isEqualTo(10.0);
        assertThat(submittedAttempt.getCorrectNum()).isEqualTo(1);
        assertThat(submittedAttempt.getIncorrectNum()).isEqualTo(0);

        QuizTaking taking = quizTakingRepository.findById(submittedAttempt.getQuizTaking().getId()).orElseThrow();
        assertThat(taking.getStatus()).isEqualTo(TakingStatus.COMPLETED);
    }

    @Test
    void saveAfterSubmitIsRejected() {
        // [TEST F] - Save after submit is rejected
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        // 1. Submit deterministic state (Option A)
        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId()));

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));
        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        // 2. Capture persisted answer state after submit
        List<UserAttemptAnswer> answersBefore = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answersBefore).hasSize(1);
        assertThat(answersBefore.get(0).getAnswer().getId()).isEqualTo(answerOptionA.getId());

        // 3. Attempt saveAnswer with Option B after submission
        SaveAnswerRequestDTO saveReq = new SaveAnswerRequestDTO();
        saveReq.setAnswerIds(List.of(answerOptionB.getId()));

        AppException ex = assertThrows(AppException.class, () -> {
            quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), saveReq);
        });
        
        // 4. Verify ATTEMPT_ALREADY_SUBMITTED
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);

        // 5. Re-read persisted answers and assert they are identical to state before rejected save
        List<UserAttemptAnswer> answersAfter = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answersAfter).hasSize(1);
        assertThat(answersAfter.get(0).getAnswer().getId()).isEqualTo(answerOptionA.getId());
    }

    @Test
    void studentCannotSaveAnotherStudentsAttempt() {
        // [TEST G] - Student cannot save another student's attempt
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO saveReq = new SaveAnswerRequestDTO();
        saveReq.setAnswerIds(List.of(answerOptionA.getId()));

        AppException ex = assertThrows(AppException.class, () -> {
            // Student B tries to save answer for Student A's attempt
            quizTakingService.saveAnswer(studentB.getId(), attemptId, singleChoiceQuestion.getId(), saveReq);
        });

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED);

        // Verify Student A's attempt was NOT changed
        List<UserAttemptAnswer> answers = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).isEmpty();
    }

    @Test
    void delayedOlderSaveCanOverwriteNewerAnswer() {
        // [TEST R1] - Reproduce stale autosave overwrite defect (now fixed)
        // Logical user order: A -> B
        // Server arrival order: B -> A (delayed)
        
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        // 1. Newer intent B reaches server first (revision 2)
        SaveAnswerRequestDTO requestB = new SaveAnswerRequestDTO();
        requestB.setAnswerIds(List.of(answerOptionB.getId()));
        requestB.setRevision(2L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), requestB);

        // 2. Delayed older intent A reaches server afterward (revision 1)
        SaveAnswerRequestDTO requestA = new SaveAnswerRequestDTO();
        requestA.setAnswerIds(List.of(answerOptionA.getId()));
        requestA.setRevision(1L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), requestA);

        // Desired invariant: final answer must still be B (the newer intent)
        List<UserAttemptAnswer> answers = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).hasSize(1);
        assertThat(answers.get(0).getAnswer().getId()).isEqualTo(answerOptionB.getId());
    }

    @Test
    void duplicateRevisionIsIdempotent() {
        // [TEST R2] - duplicate revision is idempotent
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO request1 = new SaveAnswerRequestDTO();
        request1.setAnswerIds(List.of(answerOptionB.getId()));
        request1.setRevision(2L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), request1);

        SaveAnswerRequestDTO request2 = new SaveAnswerRequestDTO();
        request2.setAnswerIds(List.of(answerOptionA.getId()));
        request2.setRevision(2L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), request2);

        // Second request with same revision must not replace B
        List<UserAttemptAnswer> answers = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).hasSize(1);
        assertThat(answers.get(0).getAnswer().getId()).isEqualTo(answerOptionB.getId());
    }

    @Test
    void newerClearProtectsAgainstStaleRestore() {
        // [TEST R3] - newer clear protects against stale restore
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        // rev1 A
        SaveAnswerRequestDTO request1 = new SaveAnswerRequestDTO();
        request1.setAnswerIds(List.of(answerOptionA.getId()));
        request1.setRevision(1L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), request1);

        // rev2 clear
        SaveAnswerRequestDTO request2 = new SaveAnswerRequestDTO();
        request2.setAnswerIds(Collections.emptyList());
        request2.setRevision(2L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), request2);

        // rev1 A delayed/retried
        SaveAnswerRequestDTO request3 = new SaveAnswerRequestDTO();
        request3.setAnswerIds(List.of(answerOptionA.getId()));
        request3.setRevision(1L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), request3);

        // Final state must remain unanswered (a tombstone)
        List<UserAttemptAnswer> answers = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).hasSize(1);
        assertThat(answers.get(0).getAnswer()).isNull();
        assertThat(answers.get(0).getSelectedText()).isNull();
        assertThat(answers.get(0).getRevision()).isEqualTo(2L);
    }
    @Test
    void revisionSurvivesStateRead() {
        // [TEST C1] - revision survives state read
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO request = new SaveAnswerRequestDTO();
        request.setAnswerIds(List.of(answerOptionA.getId()));
        request.setRevision(5L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), request);

        QuizTakingResponseDTO state = quizTakingService.getQuizTakingState(studentA.getId(), attemptId);
        assertThat(state.getAnswerRevisions()).isNotNull();
        assertThat(state.getAnswerRevisions().get(singleChoiceQuestion.getId())).isEqualTo(5L);
    }

    @Test
    void tombstoneRevisionSurvivesStateRead() {
        // [TEST C2] - tombstone revision survives state read
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO request1 = new SaveAnswerRequestDTO();
        request1.setAnswerIds(List.of(answerOptionA.getId()));
        request1.setRevision(1L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), request1);

        SaveAnswerRequestDTO request2 = new SaveAnswerRequestDTO();
        request2.setAnswerIds(Collections.emptyList()); // clear
        request2.setRevision(2L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), request2);

        QuizTakingResponseDTO state = quizTakingService.getQuizTakingState(studentA.getId(), attemptId);
        assertThat(state.getSelectedAnswers().get(singleChoiceQuestion.getId())).isNull();
        assertThat(state.getAnswerRevisions()).isNotNull();
        assertThat(state.getAnswerRevisions().get(singleChoiceQuestion.getId())).isEqualTo(2L);
    }

    @Test
    void revisionContinuesAfterReloadConceptually() {
        // [TEST C3] - revision continues after reload conceptually
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO request1 = new SaveAnswerRequestDTO();
        request1.setAnswerIds(List.of(answerOptionA.getId()));
        request1.setRevision(5L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), request1);

        QuizTakingResponseDTO state = quizTakingService.getQuizTakingState(studentA.getId(), attemptId);
        Long currentRev = state.getAnswerRevisions().get(singleChoiceQuestion.getId());
        assertThat(currentRev).isEqualTo(5L);

        // next save revision = 6
        SaveAnswerRequestDTO request2 = new SaveAnswerRequestDTO();
        request2.setAnswerIds(List.of(answerOptionB.getId()));
        request2.setRevision(6L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), request2);

        List<UserAttemptAnswer> answers = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).hasSize(1);
        assertThat(answers.get(0).getAnswer().getId()).isEqualTo(answerOptionB.getId());
        assertThat(answers.get(0).getRevision()).isEqualTo(6L);
    }

    @Test
    void staleSubmitPayloadCanOverwriteNewerAutosave() {
        // [TEST] - Reproduce stale submit overwriting newer autosave
        // 1. Start attempt
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        // 2. Save Option B through saveAnswer using revision 2
        SaveAnswerRequestDTO requestB = new SaveAnswerRequestDTO();
        requestB.setAnswerIds(List.of(answerOptionB.getId()));
        requestB.setRevision(2L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), requestB);

        // 3. Verify DB contains B revision 2
        List<UserAttemptAnswer> answers = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).hasSize(1);
        assertThat(answers.get(0).getAnswer().getId()).isEqualTo(answerOptionB.getId());
        assertThat(answers.get(0).getRevision()).isEqualTo(2L);

        // 4. Construct a submit payload containing stale Option A
        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId())); // STALE! A is older intent
        qSubmit.setRevision(1L);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        // 5. Call submitQuizAttempt
        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        // 6. Reload attempt and saved answers from DB
        Attempt finalizedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        List<UserAttemptAnswer> finalAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);

        // 7. Assert the DESIRED invariant
        assertThat(finalAnswers).hasSize(1);
        assertThat(finalAnswers.get(0).getAnswer().getId()).isEqualTo(answerOptionB.getId());
        assertThat(finalAnswers.get(0).getRevision()).isEqualTo(2L);
        assertThat(finalizedAttempt.getResult()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(finalizedAttempt.getCorrectNum()).isEqualTo(0);
        assertThat(finalizedAttempt.getIncorrectNum()).isEqualTo(1);
    }

    @Test
    void newerSubmitStateBeatsOlderAutosave() {
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO requestB = new SaveAnswerRequestDTO();
        requestB.setAnswerIds(List.of(answerOptionB.getId()));
        requestB.setRevision(2L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), requestB);

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId())); 
        qSubmit.setRevision(3L); // newer

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        Attempt finalizedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        List<UserAttemptAnswer> finalAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);

        assertThat(finalAnswers).hasSize(1);
        assertThat(finalAnswers.get(0).getAnswer().getId()).isEqualTo(answerOptionA.getId());
        assertThat(finalAnswers.get(0).getRevision()).isEqualTo(3L);
        assertThat(finalizedAttempt.getResult()).isEqualByComparingTo(BigDecimal.valueOf(10.0));
        assertThat(finalizedAttempt.getCorrectNum()).isEqualTo(1);
        assertThat(finalizedAttempt.getIncorrectNum()).isEqualTo(0);
    }

    @Test
    void equalRevisionPrefersDB() {
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO requestB = new SaveAnswerRequestDTO();
        requestB.setAnswerIds(List.of(answerOptionB.getId()));
        requestB.setRevision(2L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), requestB);

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId())); 
        qSubmit.setRevision(2L); // equal

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        Attempt finalizedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        List<UserAttemptAnswer> finalAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);

        assertThat(finalAnswers).hasSize(1);
        assertThat(finalAnswers.get(0).getAnswer().getId()).isEqualTo(answerOptionB.getId());
        assertThat(finalAnswers.get(0).getRevision()).isEqualTo(2L);
    }

    @Test
    void submitCanPersistMutationThatNeverAutosaved() {
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId())); 
        qSubmit.setRevision(1L);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        Attempt finalizedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        List<UserAttemptAnswer> finalAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);

        assertThat(finalAnswers).hasSize(1);
        assertThat(finalAnswers.get(0).getAnswer().getId()).isEqualTo(answerOptionA.getId());
        assertThat(finalAnswers.get(0).getRevision()).isEqualTo(1L);
        assertThat(finalizedAttempt.getResult()).isEqualByComparingTo(BigDecimal.valueOf(10.0));
    }

    @Test
    void legacySubmitCannotOverwriteVersionedState() {
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO requestB = new SaveAnswerRequestDTO();
        requestB.setAnswerIds(List.of(answerOptionB.getId()));
        requestB.setRevision(2L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), requestB);

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId())); 
        qSubmit.setRevision(null);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        Attempt finalizedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        List<UserAttemptAnswer> finalAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);

        assertThat(finalAnswers).hasSize(1);
        assertThat(finalAnswers.get(0).getAnswer().getId()).isEqualTo(answerOptionB.getId());
        assertThat(finalAnswers.get(0).getRevision()).isEqualTo(2L);
    }

    @Test
    void legacySubmitStillWorksWithNoVersionedState() {
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId())); 
        qSubmit.setRevision(null);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        Attempt finalizedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        List<UserAttemptAnswer> finalAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);

        assertThat(finalAnswers).hasSize(1);
        assertThat(finalAnswers.get(0).getAnswer().getId()).isEqualTo(answerOptionA.getId());
        assertThat(finalizedAttempt.getResult()).isEqualByComparingTo(BigDecimal.valueOf(10.0));
    }

    @Test
    void newerSubmitClearRemainsUnanswered() {
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO requestA = new SaveAnswerRequestDTO();
        requestA.setAnswerIds(List.of(answerOptionA.getId()));
        requestA.setRevision(4L);
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), requestA);

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of()); // clear
        qSubmit.setRevision(5L);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        Attempt finalizedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        List<UserAttemptAnswer> finalAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);

        assertThat(finalAnswers).hasSize(1);
        assertThat(finalAnswers.get(0).getAnswer()).isNull(); // Tombstone
        assertThat(finalAnswers.get(0).getSelectedText()).isNull();
        assertThat(finalAnswers.get(0).getRevision()).isEqualTo(5L);
        assertThat(finalizedAttempt.getResult()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void concurrentSubmitAndAutosaveAreSerializedSafely() throws InterruptedException {
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO requestB = new SaveAnswerRequestDTO();
        requestB.setAnswerIds(List.of(answerOptionB.getId()));
        requestB.setRevision(2L);

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionB.getId()));
        qSubmit.setRevision(2L);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        java.util.concurrent.CountDownLatch startLatch = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch doneLatch = new java.util.concurrent.CountDownLatch(2);
        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(2);

        java.util.concurrent.Future<?> autosaveFuture = executor.submit(() -> {
            try {
                startLatch.await();
                quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), requestB);
            } catch (Exception e) {
                if (e instanceof AppException && ((AppException) e).getErrorCode() == ErrorCode.ATTEMPT_ALREADY_SUBMITTED) {
                    // valid outcome
                } else {
                    throw new RuntimeException("Autosave failed unexpectedly", e);
                }
            } finally {
                doneLatch.countDown();
            }
        });

        java.util.concurrent.Future<?> submitFuture = executor.submit(() -> {
            try {
                startLatch.await();
                quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);
            } catch (Exception e) {
                throw new RuntimeException("Submit failed unexpectedly", e);
            } finally {
                doneLatch.countDown();
            }
        });

        startLatch.countDown();
        boolean finished = doneLatch.await(10, java.util.concurrent.TimeUnit.SECONDS);
        assertThat(finished).isTrue();
        executor.shutdown();

        try {
            autosaveFuture.get();
            submitFuture.get();
        } catch (java.util.concurrent.ExecutionException e) {
            org.junit.jupiter.api.Assertions.fail("Concurrency task failed", e);
        }

        Attempt finalizedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        List<UserAttemptAnswer> finalAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);

        Long takingId = finalizedAttempt.getQuizTaking().getId();
        QuizTaking taking = quizTakingRepository.findById(takingId).orElseThrow();

        assertThat(taking.getStatus()).isEqualTo(TakingStatus.COMPLETED);
        assertThat(finalAnswers).hasSize(1);
        assertThat(finalAnswers.get(0).getAnswer().getId()).isEqualTo(answerOptionB.getId());
        assertThat(finalAnswers.get(0).getRevision()).isEqualTo(2L);
        assertThat(finalizedAttempt.getResult()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void repeatedSubmitShouldBeIdempotent() {
        // [TEST I1] - sequential identical retry
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId()));
        qSubmit.setRevision(1L);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        // First submit
        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        Attempt firstAttempt = attemptRepository.findById(attemptId).orElseThrow();
        LocalDateTime firstEndedAt = firstAttempt.getEndedAt();
        BigDecimal firstResult = firstAttempt.getResult();
        int firstCorrect = firstAttempt.getCorrectNum();
        int firstIncorrect = firstAttempt.getIncorrectNum();
        
        List<UserAttemptAnswer> answersAfterFirst = userAttemptAnswerRepository.findByAttemptId(attemptId);
        Long firstAnswerId = answersAfterFirst.get(0).getAnswer().getId();
        Long firstRevision = answersAfterFirst.get(0).getRevision();

        Long notifCountAfterFirst = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notifications", Long.class);

        // Second duplicate submit
        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        Attempt secondAttempt = attemptRepository.findById(attemptId).orElseThrow();
        
        assertThat(secondAttempt.getEndedAt()).isEqualTo(firstEndedAt);
        assertThat(secondAttempt.getResult()).isEqualByComparingTo(firstResult);
        assertThat(secondAttempt.getCorrectNum()).isEqualTo(firstCorrect);
        assertThat(secondAttempt.getIncorrectNum()).isEqualTo(firstIncorrect);

        List<UserAttemptAnswer> answersAfterSecond = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answersAfterSecond).hasSize(1);
        assertThat(answersAfterSecond.get(0).getAnswer().getId()).isEqualTo(firstAnswerId);
        assertThat(answersAfterSecond.get(0).getRevision()).isEqualTo(firstRevision);

        Long notifCountAfterSecond = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notifications", Long.class);
        assertThat(notifCountAfterSecond).isEqualTo(notifCountAfterFirst);
    }

    @Test
    void retryWithDifferentPayloadCannotChangeCompletedAttempt() {
        // [TEST I2] - retry with changed payload
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        // Submit A revision 1
        QuestionSubmitRequestDTO qSubmitA = new QuestionSubmitRequestDTO();
        qSubmitA.setQuestionId(singleChoiceQuestion.getId());
        qSubmitA.setAnswerIds(List.of(answerOptionA.getId()));
        qSubmitA.setRevision(1L);

        QuizSubmitRequestDTO submitReqA = new QuizSubmitRequestDTO();
        submitReqA.setAttemptId(attemptId);
        submitReqA.setQuestions(List.of(qSubmitA));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReqA);
        
        Long notifCountAfterFirst = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notifications", Long.class);

        // Retry B revision 2
        QuestionSubmitRequestDTO qSubmitB = new QuestionSubmitRequestDTO();
        qSubmitB.setQuestionId(singleChoiceQuestion.getId());
        qSubmitB.setAnswerIds(List.of(answerOptionB.getId()));
        qSubmitB.setRevision(2L);

        QuizSubmitRequestDTO submitReqB = new QuizSubmitRequestDTO();
        submitReqB.setAttemptId(attemptId);
        submitReqB.setQuestions(List.of(qSubmitB));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReqB);

        Attempt finalizedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        List<UserAttemptAnswer> finalAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);
        
        assertThat(finalAnswers).hasSize(1);
        assertThat(finalAnswers.get(0).getAnswer().getId()).isEqualTo(answerOptionA.getId()); // Still A
        assertThat(finalAnswers.get(0).getRevision()).isEqualTo(1L); // Still 1

        assertThat(finalizedAttempt.getResult()).isEqualByComparingTo(BigDecimal.valueOf(10.0));
        
        Long notifCountAfterSecond = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notifications", Long.class);
        assertThat(notifCountAfterSecond).isEqualTo(notifCountAfterFirst);
    }

    @Test
    void concurrentDuplicateSubmitsAreIdempotent() throws InterruptedException {
        // [TEST I3] - concurrent duplicate submits
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId()));
        qSubmit.setRevision(1L);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        java.util.concurrent.CountDownLatch startLatch = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch doneLatch = new java.util.concurrent.CountDownLatch(2);
        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(2);

        java.util.concurrent.Callable<Void> task = () -> {
            try {
                startLatch.await();
                quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);
            } finally {
                doneLatch.countDown();
            }
            return null;
        };

        java.util.concurrent.Future<Void> future1 = executor.submit(task);
        java.util.concurrent.Future<Void> future2 = executor.submit(task);

        startLatch.countDown();
        boolean finished = doneLatch.await(10, java.util.concurrent.TimeUnit.SECONDS);
        assertThat(finished).isTrue();
        executor.shutdown();

        try {
            future1.get();
            future2.get();
        } catch (java.util.concurrent.ExecutionException e) {
            org.junit.jupiter.api.Assertions.fail("Concurrency task failed", e);
        }

        Attempt finalizedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        List<UserAttemptAnswer> finalAnswers = userAttemptAnswerRepository.findByAttemptId(attemptId);

        assertThat(finalAnswers).hasSize(1);
        assertThat(finalAnswers.get(0).getAnswer().getId()).isEqualTo(answerOptionA.getId());
        assertThat(finalAnswers.get(0).getRevision()).isEqualTo(1L);
        assertThat(finalizedAttempt.getResult()).isEqualByComparingTo(BigDecimal.valueOf(10.0));
        assertThat(finalizedAttempt.getCorrectNum()).isEqualTo(1);
        assertThat(finalizedAttempt.getIncorrectNum()).isEqualTo(0);
        
        Long notifCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notifications", Long.class);
        assertThat(notifCount).isEqualTo(1L);
    }
    
    @Test
    void studentCannotSubmitAnotherStudentsCompletedAttempt() {
        // [TEST I4] - ownership still enforced
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(singleChoiceQuestion.getId());
        qSubmit.setAnswerIds(List.of(answerOptionA.getId()));
        qSubmit.setRevision(1L);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        // First submit by owner (Student A)
        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        // Student B tries to submit Student A's attempt
        AppException ex = assertThrows(AppException.class, () -> {
            quizTakingService.submitQuizAttempt(studentB.getId(), submitReq);
        });

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    void fillInBlankGradingHandlesWhitespaceAndCaseInsensitivity() {
        User teacher = userRepository.findAll().stream().filter(u -> "teacher@test.com".equals(u.getEmail())).findFirst().orElseThrow();
        Classroom classroom = classroomRepository.findAll().get(0);

        Quiz fillQuiz = quizRepository.save(Quiz.builder()
                .title("Fill in Blank Quiz")
                .description("Testing fill in blank grading")
                .creator(teacher)
                .isDraft(false)
                .isEnable(true)
                .isExam(false)
                .build());

        Question fillQuestion = questionRepository.save(Question.builder()
                .text("Capital of France?")
                .type(QuestionType.FILL_IN_BLANK)
                .build());

        fillQuiz.setQuestions(List.of(fillQuestion));
        quizRepository.save(fillQuiz);

        answerRepository.save(Answer.builder()
                .question(fillQuestion)
                .text("Paris")
                .isCorrect(true)
                .build());

        answerRepository.save(Answer.builder()
                .question(fillQuestion)
                .text("London")
                .isCorrect(false)
                .build());

        QuizAssigning fillAssignedQuiz = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(fillQuiz)
                .classroom(classroom)
                .durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false)
                .build());

        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), fillAssignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(fillQuestion.getId());
        qSubmit.setSelectedText("  pArIs  ");

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        Attempt submittedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        
        assertThat(submittedAttempt.getEndedAt()).isNotNull();
        assertThat(submittedAttempt.getResult()).isEqualByComparingTo(BigDecimal.valueOf(10.0));
        assertThat(submittedAttempt.getCorrectNum()).isEqualTo(1);
        assertThat(submittedAttempt.getIncorrectNum()).isEqualTo(0);

        QuizTaking taking = quizTakingRepository.findById(submittedAttempt.getQuizTaking().getId()).orElseThrow();
        assertThat(taking.getStatus()).isEqualTo(TakingStatus.COMPLETED);
    }

    @Test
    void fillInBlankGradingRejectsIncorrectFalseAlternatives() {
        User teacher = userRepository.findAll().stream().filter(u -> "teacher@test.com".equals(u.getEmail())).findFirst().orElseThrow();
        Classroom classroom = classroomRepository.findAll().get(0);

        Quiz fillQuiz = quizRepository.save(Quiz.builder()
                .title("Fill in Blank Quiz False Alternative")
                .description("Testing fill in blank grading")
                .creator(teacher)
                .isDraft(false)
                .isEnable(true)
                .isExam(false)
                .build());

        Question fillQuestion = questionRepository.save(Question.builder()
                .text("Capital of France?")
                .type(QuestionType.FILL_IN_BLANK)
                .build());

        fillQuiz.setQuestions(List.of(fillQuestion));
        quizRepository.save(fillQuiz);

        answerRepository.save(Answer.builder()
                .question(fillQuestion)
                .text("Paris")
                .isCorrect(true)
                .build());

        answerRepository.save(Answer.builder()
                .question(fillQuestion)
                .text("London")
                .isCorrect(false)
                .build());

        QuizAssigning fillAssignedQuiz = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(fillQuiz)
                .classroom(classroom)
                .durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false)
                .build());

        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), fillAssignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(fillQuestion.getId());
        qSubmit.setSelectedText("London");

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        quizTakingService.submitQuizAttempt(studentA.getId(), submitReq);

        Attempt submittedAttempt = attemptRepository.findById(attemptId).orElseThrow();
        
        assertThat(submittedAttempt.getEndedAt()).isNotNull();
        assertThat(submittedAttempt.getResult()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(submittedAttempt.getCorrectNum()).isEqualTo(0);
        assertThat(submittedAttempt.getIncorrectNum()).isEqualTo(1);

        QuizTaking taking = quizTakingRepository.findById(submittedAttempt.getQuizTaking().getId()).orElseThrow();
        assertThat(taking.getStatus()).isEqualTo(TakingStatus.COMPLETED);
    }
}

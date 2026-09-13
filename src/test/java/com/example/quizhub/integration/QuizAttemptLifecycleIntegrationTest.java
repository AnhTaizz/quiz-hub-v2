package com.example.quizhub.integration;

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
import java.util.List;
import java.util.UUID;

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
    @org.junit.jupiter.api.Disabled("Known V2 defect: delayed stale autosave can overwrite newer answer because save requests have no ordering/revision metadata.")
    void delayedOlderSaveCanOverwriteNewerAnswer() {
        // Reproduce stale autosave overwrite defect
        // Logical user order: A -> B
        // Server arrival order: B -> A (delayed)
        
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        // 1. Newer intent B reaches server first
        SaveAnswerRequestDTO requestB = new SaveAnswerRequestDTO();
        requestB.setAnswerIds(List.of(answerOptionB.getId()));
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), requestB);

        // 2. Delayed older intent A reaches server afterward
        SaveAnswerRequestDTO requestA = new SaveAnswerRequestDTO();
        requestA.setAnswerIds(List.of(answerOptionA.getId()));
        quizTakingService.saveAnswer(studentA.getId(), attemptId, singleChoiceQuestion.getId(), requestA);

        // Desired invariant: final answer must still be B (the newer intent)
        // With current code, this will fail because A overwrites B.
        List<UserAttemptAnswer> answers = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).hasSize(1);
        assertThat(answers.get(0).getAnswer().getId()).isEqualTo(answerOptionB.getId());
    }
}

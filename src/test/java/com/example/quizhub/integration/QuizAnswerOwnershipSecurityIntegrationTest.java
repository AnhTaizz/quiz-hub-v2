package com.example.quizhub.integration;

import com.example.quizhub.dto.quiztaking.request.QuestionSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.request.QuizSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.request.SaveAnswerRequestDTO;
import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.quiz.QuizTakingService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Proves the backend rejects cross-quiz/cross-question entity injection:
 * a client must never be able to save or submit an answer/question that
 * does not belong to the quiz graph of the attempt being mutated.
 */
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class QuizAnswerOwnershipSecurityIntegrationTest {

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

    private User student;
    private QuizAssigning assignedQuizA;

    private Question questionA1;
    private Question questionA2;
    private Answer answerA1Correct;
    private Answer answerA2Correct;

    private Question questionB1;
    private Answer answerB1;

    private Long attemptIdA;

    @BeforeEach
    void setup() {
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

        User teacher = userRepository.save(User.builder()
                .email("teacher_own@test.com").password("pw").fullName("Teacher")
                .isEnable(true).isVerified(true).role(Role.TEACHER).build());

        student = userRepository.save(User.builder()
                .email("student_own@test.com").password("pw").fullName("Student")
                .isEnable(true).isVerified(true).role(Role.STUDENT).build());

        Classroom classroom = classroomRepository.save(Classroom.builder()
                .name("Ownership Class").creator(teacher).code("OWN123").isEnable(true).build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom).learner(student).status(JoinStatus.APPROVED).build());

        // --- Quiz A: two questions ---
        Quiz quizA = quizRepository.save(Quiz.builder()
                .title("Quiz A").creator(teacher).isDraft(false).isEnable(true).isExam(false).build());

        questionA1 = questionRepository.save(Question.builder().text("A1?").type(QuestionType.SINGLE_CHOICE).build());
        questionA2 = questionRepository.save(Question.builder().text("A2?").type(QuestionType.SINGLE_CHOICE).build());
        quizA.setQuestions(List.of(questionA1, questionA2));
        quizRepository.save(quizA);

        answerA1Correct = answerRepository.save(Answer.builder().question(questionA1).text("A1-correct").isCorrect(true).build());
        answerRepository.save(Answer.builder().question(questionA1).text("A1-wrong").isCorrect(false).build());
        answerA2Correct = answerRepository.save(Answer.builder().question(questionA2).text("A2-correct").isCorrect(true).build());

        assignedQuizA = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quizA).classroom(classroom).durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false).build());

        // --- Quiz B: foreign quiz, not assigned to this student's attempt ---
        Quiz quizB = quizRepository.save(Quiz.builder()
                .title("Quiz B").creator(teacher).isDraft(false).isEnable(true).isExam(false).build());

        questionB1 = questionRepository.save(Question.builder().text("B1?").type(QuestionType.SINGLE_CHOICE).build());
        quizB.setQuestions(List.of(questionB1));
        quizRepository.save(quizB);

        answerB1 = answerRepository.save(Answer.builder().question(questionB1).text("B1-answer").isCorrect(true).build());

        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(student.getId(), assignedQuizA.getId());
        attemptIdA = startRes.getAttemptId();
    }

    @Test
    void autosaveRejectsQuestionFromAnotherQuiz() {
        SaveAnswerRequestDTO req = new SaveAnswerRequestDTO();
        req.setAnswerIds(List.of(answerB1.getId()));

        AppException ex = assertThrows(AppException.class,
                () -> quizTakingService.saveAnswer(student.getId(), attemptIdA, questionB1.getId(), req));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.QUESTION_NOT_IN_QUIZ);
        assertThat(userAttemptAnswerRepository.findByAttemptId(attemptIdA)).isEmpty();
    }

    @Test
    void autosaveRejectsAnswerFromAnotherQuestion() {
        // questionA1 belongs to Quiz A, but answerB1 belongs to Quiz B's question
        SaveAnswerRequestDTO req = new SaveAnswerRequestDTO();
        req.setAnswerIds(List.of(answerB1.getId()));

        AppException ex = assertThrows(AppException.class,
                () -> quizTakingService.saveAnswer(student.getId(), attemptIdA, questionA1.getId(), req));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.ANSWER_NOT_IN_QUESTION);
        assertThat(userAttemptAnswerRepository.findByAttemptId(attemptIdA)).isEmpty();
    }

    @Test
    void autosaveRejectsAnswerBelongingToDifferentQuestionInSameQuiz() {
        // questionA1 and answerA2Correct both belong to Quiz A, but to different questions
        SaveAnswerRequestDTO req = new SaveAnswerRequestDTO();
        req.setAnswerIds(List.of(answerA2Correct.getId()));

        AppException ex = assertThrows(AppException.class,
                () -> quizTakingService.saveAnswer(student.getId(), attemptIdA, questionA1.getId(), req));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.ANSWER_NOT_IN_QUESTION);
        assertThat(userAttemptAnswerRepository.findByAttemptId(attemptIdA)).isEmpty();
    }

    @Test
    void submitRejectsQuestionFromAnotherQuiz() {
        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(questionB1.getId());
        qSubmit.setAnswerIds(List.of(answerB1.getId()));

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptIdA);
        submitReq.setQuestions(List.of(qSubmit));

        AppException ex = assertThrows(AppException.class,
                () -> quizTakingService.submitQuizAttempt(student.getId(), submitReq));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.QUESTION_NOT_IN_QUIZ);

        Attempt attempt = attemptRepository.findById(attemptIdA).orElseThrow();
        assertThat(attempt.getEndedAt()).isNull();
        assertThat(userAttemptAnswerRepository.findByAttemptId(attemptIdA)).isEmpty();
    }

    @Test
    void submitRejectsAnswerFromAnotherQuiz() {
        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(questionA1.getId());
        qSubmit.setAnswerIds(List.of(answerB1.getId()));

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptIdA);
        submitReq.setQuestions(List.of(qSubmit));

        AppException ex = assertThrows(AppException.class,
                () -> quizTakingService.submitQuizAttempt(student.getId(), submitReq));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.ANSWER_NOT_IN_QUESTION);

        Attempt attempt = attemptRepository.findById(attemptIdA).orElseThrow();
        assertThat(attempt.getEndedAt()).isNull();
        assertThat(userAttemptAnswerRepository.findByAttemptId(attemptIdA)).isEmpty();
    }

    @Test
    void submitValidatesWholePayloadBeforeApplyingAnyMutation() {
        // First question is valid, second is malformed (foreign question) -> nothing should persist
        QuestionSubmitRequestDTO validQ = new QuestionSubmitRequestDTO();
        validQ.setQuestionId(questionA1.getId());
        validQ.setAnswerIds(List.of(answerA1Correct.getId()));

        QuestionSubmitRequestDTO invalidQ = new QuestionSubmitRequestDTO();
        invalidQ.setQuestionId(questionB1.getId());
        invalidQ.setAnswerIds(List.of(answerB1.getId()));

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptIdA);
        submitReq.setQuestions(List.of(validQ, invalidQ));

        AppException ex = assertThrows(AppException.class,
                () -> quizTakingService.submitQuizAttempt(student.getId(), submitReq));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.QUESTION_NOT_IN_QUIZ);

        Attempt attempt = attemptRepository.findById(attemptIdA).orElseThrow();
        assertThat(attempt.getEndedAt()).isNull();
        // The valid question's answer must NOT have been persisted either.
        assertThat(userAttemptAnswerRepository.findByAttemptId(attemptIdA)).isEmpty();
    }

    @Test
    void duplicateAnswerIdsDoNotCreateDuplicatePersistedState() {
        SaveAnswerRequestDTO req = new SaveAnswerRequestDTO();
        req.setAnswerIds(List.of(answerA1Correct.getId(), answerA1Correct.getId()));

        quizTakingService.saveAnswer(student.getId(), attemptIdA, questionA1.getId(), req);

        List<UserAttemptAnswer> answers = userAttemptAnswerRepository.findByAttemptId(attemptIdA);
        assertThat(answers).hasSize(1);
        assertThat(answers.get(0).getAnswer().getId()).isEqualTo(answerA1Correct.getId());
    }
}

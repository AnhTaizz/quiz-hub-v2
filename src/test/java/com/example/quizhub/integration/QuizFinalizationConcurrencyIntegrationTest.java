package com.example.quizhub.integration;

import com.example.quizhub.dto.quiztaking.request.QuestionSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.request.QuizSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.entity.enums.TakingStatus;
import com.example.quizhub.repository.*;
import com.example.quizhub.scheduler.QuizScheduler;
import com.example.quizhub.service.quiz.QuizTakingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves a manual submit racing the scheduled expiration sweep converges on exactly one
 * finalized, consistent attempt state instead of double-finalizing or corrupting answers.
 *
 * The real QuizScheduler bean is replaced with a mock: it runs on a live "0 * * * * *" cron
 * for the whole test JVM regardless of which test is executing, so without this the test would
 * be non-deterministic whenever a minute boundary happens to land mid-test.
 */
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class QuizFinalizationConcurrencyIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @MockitoBean
    private QuizScheduler quizScheduler;

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
    private Long attemptId;
    private Question question;
    private Answer correctAnswer;
    private QuizAssigning assigning;

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
                .email("teacher_finconc@test.com").password("pw").fullName("Teacher")
                .isEnable(true).isVerified(true).role(Role.TEACHER).build());

        student = userRepository.save(User.builder()
                .email("student_finconc@test.com").password("pw").fullName("Student")
                .isEnable(true).isVerified(true).role(Role.STUDENT).build());

        Classroom classroom = classroomRepository.save(Classroom.builder()
                .name("Finalization Concurrency Class").creator(teacher).code("FCONC123").isEnable(true).build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom).learner(student).status(JoinStatus.APPROVED).build());

        Quiz quiz = quizRepository.save(Quiz.builder()
                .title("Finalization Concurrency Quiz").creator(teacher)
                .isDraft(false).isEnable(true).isExam(false).build());

        question = questionRepository.save(Question.builder().text("Q?").type(QuestionType.SINGLE_CHOICE).build());
        quiz.setQuestions(List.of(question));
        quizRepository.save(quiz);
        correctAnswer = answerRepository.save(Answer.builder().question(question).text("Correct").isCorrect(true).build());
        answerRepository.save(Answer.builder().question(question).text("Wrong").isCorrect(false).build());

        assigning = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz).classroom(classroom).durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(30))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false).build());

        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(student.getId(), assigning.getId());
        attemptId = startRes.getAttemptId();

        // Simulate the assignment's deadline having just passed, so both the scheduled sweep
        // and a manual submit consider this attempt expired at the same time.
        assigning.setDueDate(LocalDateTime.now().minusMinutes(1));
        quizAssigningRepository.save(assigning);
    }

    @Test
    void manualSubmitRacingScheduledSweepConvergesOnOneConsistentResult() throws Exception {
        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(question.getId());
        qSubmit.setAnswerIds(List.of(correctAnswer.getId()));

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(2);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        Future<?> manualSubmitFuture = executor.submit(() -> {
            try {
                startLatch.await();
                quizTakingService.submitQuizAttempt(student.getId(), submitReq);
            } catch (Exception e) {
                throw new RuntimeException("Manual submit failed unexpectedly", e);
            } finally {
                doneLatch.countDown();
            }
        });

        Future<?> schedulerFuture = executor.submit(() -> {
            try {
                startLatch.await();
                quizTakingService.autoSubmitExpiredAttempts();
            } catch (Exception e) {
                throw new RuntimeException("Scheduler sweep failed unexpectedly", e);
            } finally {
                doneLatch.countDown();
            }
        });

        startLatch.countDown();
        boolean finished = doneLatch.await(15, TimeUnit.SECONDS);
        assertThat(finished).isTrue();
        executor.shutdown();

        manualSubmitFuture.get();
        schedulerFuture.get();

        Attempt finalAttempt = attemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalAttempt.getEndedAt()).isNotNull();
        assertThat(finalAttempt.getResult()).isNotNull();
        assertThat(finalAttempt.getCorrectNum()).isNotNull();
        assertThat(finalAttempt.getIncorrectNum()).isNotNull();

        QuizTaking taking = quizTakingRepository.findById(finalAttempt.getQuizTaking().getId()).orElseThrow();
        assertThat(taking.getStatus()).isEqualTo(TakingStatus.COMPLETED);

        // No duplicate/corrupted answer rows from a double-finalization race.
        List<UserAttemptAnswer> answers = userAttemptAnswerRepository.findByAttemptId(attemptId);
        assertThat(answers).hasSizeLessThanOrEqualTo(1);

        long notifCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notifications", Long.class);
        assertThat(notifCount).isEqualTo(1L);
    }
}

package com.example.quizhub.integration;

import com.example.quizhub.dto.quiztaking.request.ViolationRequestDTO;
import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.dto.quiztaking.response.ViolationResponseDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.entity.enums.TakingStatus;
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
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the violation-threshold auto-submit race is serialized at the database level:
 * two concurrent requests that both cross the auto-submit threshold must not double-finalize
 * the attempt or keep accumulating violations past the point the attempt was submitted.
 */
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class QuizViolationConcurrencyIntegrationTest {

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
    private AttemptViolationRepository attemptViolationRepository;
    @Autowired
    private ExamViolationRepository examViolationRepository;
    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Autowired
    private UserAttemptAnswerRepository userAttemptAnswerRepository;

    private User student;
    private Long attemptId;

    @BeforeEach
    void setup() {
        userAttemptAnswerRepository.deleteAllInBatch();
        attemptViolationRepository.deleteAllInBatch();
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
                .email("teacher_vconc@test.com").password("pw").fullName("Teacher")
                .isEnable(true).isVerified(true).role(Role.TEACHER).build());

        student = userRepository.save(User.builder()
                .email("student_vconc@test.com").password("pw").fullName("Student")
                .isEnable(true).isVerified(true).role(Role.STUDENT).build());

        Classroom classroom = classroomRepository.save(Classroom.builder()
                .name("Violation Concurrency Class").creator(teacher).code("VCONC123").isEnable(true).build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom).learner(student).status(JoinStatus.APPROVED).build());

        Quiz quiz = quizRepository.save(Quiz.builder()
                .title("Violation Concurrency Quiz").creator(teacher)
                .isDraft(false).isEnable(true).isExam(false).build());

        Question question = questionRepository.save(Question.builder()
                .text("Q?").type(QuestionType.SINGLE_CHOICE).build());
        quiz.setQuestions(List.of(question));
        quizRepository.save(quiz);
        answerRepository.save(Answer.builder().question(question).text("A").isCorrect(true).build());

        QuizAssigning assigning = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz).classroom(classroom).durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false).build());

        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(student.getId(), assigning.getId());
        attemptId = startRes.getAttemptId();

        // Seed 2 pre-existing violations so the next violation crosses the threshold (3).
        ExamViolation violationType = examViolationRepository.findByViolationCode("TAB_SWITCH")
                .orElseGet(() -> examViolationRepository.save(ExamViolation.builder()
                        .violationCode("TAB_SWITCH").severityLevel(2).description("Chuyển Tab trình duyệt").build()));

        Attempt attempt = attemptRepository.findById(attemptId).orElseThrow();
        for (int i = 0; i < 2; i++) {
            attemptViolationRepository.save(AttemptViolation.builder()
                    .attempt(attempt)
                    .violationType(violationType)
                    .occurredAt(LocalDateTime.now())
                    .build());
        }
    }

    @Test
    void concurrentThresholdCrossingViolationsDoNotDoubleFinalize() throws Exception {
        assertThat(attemptViolationRepository.countByAttemptId(attemptId)).isEqualTo(2);

        ViolationRequestDTO request = new ViolationRequestDTO();
        request.setAttemptId(attemptId);
        request.setViolationCode("TAB_SWITCH");

        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(2);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        Callable<ViolationResponseDTO> task = () -> {
            try {
                startLatch.await();
                return quizTakingService.recordViolation(student.getId(), request);
            } finally {
                doneLatch.countDown();
            }
        };

        Future<ViolationResponseDTO> future1 = executor.submit(task);
        Future<ViolationResponseDTO> future2 = executor.submit(task);

        startLatch.countDown();
        boolean finished = doneLatch.await(15, TimeUnit.SECONDS);
        assertThat(finished).isTrue();
        executor.shutdown();

        ViolationResponseDTO response1 = future1.get();
        ViolationResponseDTO response2 = future2.get();

        // Exactly one of the two concurrent requests observed the crossing and auto-submitted.
        long autoSubmittedCount = List.of(response1, response2).stream()
                .filter(ViolationResponseDTO::isAutoSubmitted)
                .count();
        assertThat(autoSubmittedCount).isEqualTo(1);

        Attempt finalAttempt = attemptRepository.findById(attemptId).orElseThrow();
        assertThat(finalAttempt.getEndedAt()).isNotNull();

        QuizTaking taking = quizTakingRepository.findById(finalAttempt.getQuizTaking().getId()).orElseThrow();
        assertThat(taking.getStatus()).isEqualTo(TakingStatus.COMPLETED);

        // The loser must not have appended a 4th violation after the attempt was submitted.
        long finalViolationCount = attemptViolationRepository.countByAttemptId(attemptId);
        assertThat(finalViolationCount).isEqualTo(3);
    }
}

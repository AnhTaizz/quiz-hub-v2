package com.example.quizhub.integration;

import com.example.quizhub.dto.student.QuizDashboardInfoDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.entity.enums.TakingStatus;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.student.StudentHomeService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class StudentQuizListScaleBenchmarkTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired
    private StudentHomeService studentHomeService;
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
    private UserAttemptAnswerRepository userAttemptAnswerRepository;
    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Autowired
    private EntityManagerFactory entityManagerFactory;
    @Autowired
    private EntityManager entityManager;

    private User teacher;
    private Classroom classroom;

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

        teacher = userRepository.save(User.builder()
                .email("teacher_list@test.com")
                .password("hashedpw")
                .fullName("Teacher List")
                .isEnable(true)
                .isVerified(true)
                .role(Role.TEACHER).build());

        classroom = classroomRepository.save(Classroom.builder()
                .name("Quiz List Scale Class")
                .creator(teacher)
                .code("QLS123")
                .isEnable(true)
                .build());
    }

    private static class ScaleResult {
        int assignmentCount;
        long sqlQueries;
        long elapsedMs;
    }

    @Test
    void measureGetAllQuizzesScaling() {
        ScaleResult q10 = measureWorkload(10);
        ScaleResult q50 = measureWorkload(50);
        ScaleResult q100 = measureWorkload(100);

        System.out.println();
        System.out.println("Student Quiz List Scale Benchmark");
        System.out.println("=================================");
        System.out.printf("%-20s %8s %8s %8s%n", "", "10Q", "50Q", "100Q");
        System.out.println("-".repeat(48));
        System.out.printf("%-20s %8d %8d %8d%n", "SQL queries", q10.sqlQueries, q50.sqlQueries, q100.sqlQueries);
        System.out.printf("%-20s %8d %8d %8d%n", "elapsed ms", q10.elapsedMs, q50.elapsedMs, q100.elapsedMs);
        System.out.println();
    }

    private ScaleResult measureWorkload(int assignmentCount) {
        // Clean all data for isolation
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

        // Recreate shared fixtures
        teacher = userRepository.save(User.builder()
                .email("teacher_list@test.com")
                .password("hashedpw")
                .fullName("Teacher List")
                .isEnable(true)
                .isVerified(true)
                .role(Role.TEACHER).build());

        classroom = classroomRepository.save(Classroom.builder()
                .name("Quiz List Scale Class")
                .creator(teacher)
                .code("QLS123")
                .isEnable(true)
                .build());

        // 1 student, 1 approved classroom
        User student = userRepository.save(User.builder()
                .email("student_list@test.com")
                .password("hashedpw")
                .fullName("Student List")
                .isEnable(true)
                .isVerified(true)
                .role(Role.STUDENT).build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom)
                .learner(student)
                .status(JoinStatus.APPROVED)
                .build());

        // Also add a hidden assignment that must NOT leak into results
        Quiz hiddenQuiz = quizRepository.save(Quiz.builder()
                .title("Hidden Quiz")
                .description("Should not appear")
                .creator(teacher)
                .isDraft(false)
                .isEnable(true)
                .isExam(false)
                .build());

        Question hiddenQuestion = questionRepository.save(Question.builder()
                .text("Hidden Q")
                .type(QuestionType.SINGLE_CHOICE)
                .build());
        hiddenQuiz.setQuestions(List.of(hiddenQuestion));
        quizRepository.save(hiddenQuiz);

        answerRepository.save(Answer.builder()
                .question(hiddenQuestion)
                .text("Hidden A")
                .isCorrect(true)
                .build());

        quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(hiddenQuiz)
                .classroom(classroom)
                .durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(true)
                .maxAttempt(3)
                .build());

        // Create N visible assignments, each with unique quiz, 1 taking, 1 completed attempt
        List<QuizAssigning> expectedAssignments = new ArrayList<>();
        for (int i = 0; i < assignmentCount; i++) {
            Quiz quiz = quizRepository.save(Quiz.builder()
                    .title("Scale Quiz " + i)
                    .description("Quiz for scale test")
                    .creator(teacher)
                    .isDraft(false)
                    .isEnable(true)
                    .isExam(false)
                    .build());

            Question question = questionRepository.save(Question.builder()
                    .text("Question " + i)
                    .type(QuestionType.SINGLE_CHOICE)
                    .build());
            quiz.setQuestions(List.of(question));
            quizRepository.save(quiz);

            answerRepository.save(Answer.builder()
                    .question(question)
                    .text("Correct Answer " + i)
                    .isCorrect(true)
                    .build());

            QuizAssigning assigning = quizAssigningRepository.save(QuizAssigning.builder()
                    .quiz(quiz)
                    .classroom(classroom)
                    .durationInMins(60)
                    .startDate(LocalDateTime.now().minusMinutes(5))
                    .dueDate(LocalDateTime.now().plusDays(1))
                    .isHidden(false)
                    .maxAttempt(3)
                    .build());
            expectedAssignments.add(assigning);

            // 1 QuizTaking per assignment
            QuizTaking taking = quizTakingRepository.save(QuizTaking.builder()
                    .learner(student)
                    .quiz(quiz)
                    .quizAssigning(assigning)
                    .isAssigned(true)
                    .status(TakingStatus.COMPLETED)
                    .build());

            // 1 completed Attempt per taking
            attemptRepository.save(Attempt.builder()
                    .quizTaking(taking)
                    .startedAt(LocalDateTime.now().minusMinutes(10))
                    .endedAt(LocalDateTime.now().minusMinutes(5))
                    .result(BigDecimal.valueOf(10.0))
                    .correctNum(1)
                    .incorrectNum(0)
                    .totalQuestNum(1)
                    .build());
        }

        // Clear persistence context to prevent reuse of cached entities
        entityManager.clear();

        // Setup Hibernate Statistics
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();

        // Measure
        long startNanos = System.nanoTime();
        List<QuizDashboardInfoDTO> result = studentHomeService.getAllQuizzes("student_list@test.com");
        long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000;
        long sqlCount = stats.getPrepareStatementCount();

        // ── Correctness Assertions ──

        // Result size must equal N (hidden must not leak)
        assertThat(result).hasSize(assignmentCount);

        // All returned assignment IDs must be unique
        Set<Long> returnedIds = result.stream()
                .map(dto -> dto.getAssigning().getId())
                .collect(Collectors.toSet());
        assertThat(returnedIds).hasSize(assignmentCount);

        // All N expected assignments must be present
        Set<Long> expectedIds = expectedAssignments.stream()
                .map(QuizAssigning::getId)
                .collect(Collectors.toSet());
        assertThat(returnedIds).containsExactlyInAnyOrderElementsOf(expectedIds);

        // DTO field correctness for each item
        for (QuizDashboardInfoDTO dto : result) {
            assertThat(dto.getAttemptsMade())
                    .as("attemptsMade for assignment %d", dto.getAssigning().getId())
                    .isEqualTo(1);
            assertThat(dto.isHasStarted())
                    .as("hasStarted for assignment %d", dto.getAssigning().getId())
                    .isTrue();
            assertThat(dto.isHasUnfinished())
                    .as("hasUnfinished for assignment %d", dto.getAssigning().getId())
                    .isFalse();
            // maxAttempt=3, finishedCount=1, so attemptsLeft = 3-1 = 2
            assertThat(dto.getAttemptsLeft())
                    .as("attemptsLeft for assignment %d", dto.getAssigning().getId())
                    .isEqualTo(2);
        }

        // No hidden assignment leaked
        boolean anyHidden = result.stream()
                .anyMatch(dto -> Boolean.TRUE.equals(dto.getAssigning().getIsHidden()));
        assertThat(anyHidden).isFalse();

        ScaleResult sr = new ScaleResult();
        sr.assignmentCount = assignmentCount;
        sr.sqlQueries = sqlCount;
        sr.elapsedMs = elapsedMs;
        return sr;
    }
}

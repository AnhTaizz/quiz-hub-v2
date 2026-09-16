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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.test.annotation.DirtiesContext;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.jpa.properties.hibernate.session_factory.statement_inspector=com.example.quizhub.integration.SqlCaptureInspector"
})
@Testcontainers
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class StudentQuizListSqlTraceTest {

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
                .email("teacher_trace@test.com")
                .password("hashedpw")
                .fullName("Teacher Trace")
                .isEnable(true)
                .isVerified(true)
                .role(Role.TEACHER).build());

        classroom = classroomRepository.save(Classroom.builder()
                .name("Quiz List Trace Class")
                .creator(teacher)
                .code("QLT123")
                .isEnable(true)
                .build());
    }

    private String normalizeSql(String sql) {
        String s = sql.trim().replaceAll("\\s+", " ");
        s = s.replaceAll("[$]\\d+", "?"); // PostgreSQL parameters
        return s;
    }

    @Test
    void traceGetAllQuizzesScaling() {
        Map<String, Long> q10 = traceWorkload(10);
        Map<String, Long> q50 = traceWorkload(50);
        Map<String, Long> q100 = traceWorkload(100);

        Set<String> allSql = new TreeSet<>(q10.keySet());
        allSql.addAll(q50.keySet());
        allSql.addAll(q100.keySet());

        System.out.println();
        System.out.println("SQL template | 10Q | 50Q | 100Q");
        System.out.println("-".repeat(80));
        for (String sql : allSql) {
            long count10 = q10.getOrDefault(sql, 0L);
            long count50 = q50.getOrDefault(sql, 0L);
            long count100 = q100.getOrDefault(sql, 0L);
            System.out.printf("%-45s | %4d | %4d | %4d%n",
                    sql.substring(0, Math.min(sql.length(), 45)), count10, count50, count100);
            if (sql.length() > 45) {
                System.out.println("  " + sql);
            }
        }
        
        long total10 = q10.values().stream().mapToLong(Long::longValue).sum();
        long total50 = q50.values().stream().mapToLong(Long::longValue).sum();
        long total100 = q100.values().stream().mapToLong(Long::longValue).sum();
        System.out.println("-".repeat(80));
        System.out.printf("TOTALS %39s| %4d | %4d | %4d%n", "", total10, total50, total100);

        long quizTakingSelects10 = q10.entrySet().stream()
                .filter(e -> e.getKey().contains("from _quiz_taking"))
                .mapToLong(Map.Entry::getValue).sum();
        long quizTakingSelects100 = q100.entrySet().stream()
                .filter(e -> e.getKey().contains("from _quiz_taking"))
                .mapToLong(Map.Entry::getValue).sum();

        long attemptSelects10 = q10.entrySet().stream()
                .filter(e -> e.getKey().contains("from _attempt"))
                .mapToLong(Map.Entry::getValue).sum();
        long attemptSelects100 = q100.entrySet().stream()
                .filter(e -> e.getKey().contains("from _attempt"))
                .mapToLong(Map.Entry::getValue).sum();
                
        long quizSelects10 = q10.entrySet().stream()
                .filter(e -> e.getKey().contains("from _quiz"))
                .mapToLong(Map.Entry::getValue).sum();
        long quizSelects100 = q100.entrySet().stream()
                .filter(e -> e.getKey().contains("from _quiz"))
                .mapToLong(Map.Entry::getValue).sum();

        assertThat(quizTakingSelects100).isLessThanOrEqualTo(quizTakingSelects10 + 1);
        assertThat(attemptSelects100).isLessThanOrEqualTo(attemptSelects10 + 1);
        
        // Assert that the queries are approximately constant and not scaling with assignments
        assertThat(quizTakingSelects100).isLessThanOrEqualTo(2);
        assertThat(attemptSelects100).isLessThanOrEqualTo(2);
        
        // Overall total queries shouldn't scale linearly anymore
        assertThat(total100).isLessThanOrEqualTo(total10 + 2);
    }

    private Map<String, Long> traceWorkload(int assignmentCount) {
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
                .email("teacher_trace@test.com")
                .password("hashedpw")
                .fullName("Teacher Trace")
                .isEnable(true)
                .isVerified(true)
                .role(Role.TEACHER).build());

        classroom = classroomRepository.save(Classroom.builder()
                .name("Quiz List Trace Class")
                .creator(teacher)
                .code("QLT123")
                .isEnable(true)
                .build());

        // 1 student, 1 approved classroom
        User student = userRepository.save(User.builder()
                .email("student_trace@test.com")
                .password("hashedpw")
                .fullName("Student Trace")
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
                    .title("Trace Quiz " + i)
                    .description("Quiz for trace test")
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

        // Trace
        SqlCaptureInspector.start();
        List<QuizDashboardInfoDTO> result = studentHomeService.getAllQuizzes("student_trace@test.com");
        List<String> sqls = SqlCaptureInspector.stop();

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

        return sqls.stream()
                .map(this::normalizeSql)
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));
    }
}

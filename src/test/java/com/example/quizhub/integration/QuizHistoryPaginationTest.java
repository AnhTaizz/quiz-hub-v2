package com.example.quizhub.integration;

import com.example.quizhub.dto.student.QuizHistoryItemDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.student.StudentHomeService;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import jakarta.persistence.EntityManagerFactory;

import com.example.quizhub.entity.enums.Role;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
public class QuizHistoryPaginationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired
    private StudentHomeService studentHomeService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private QuizRepository quizRepository;

    @Autowired
    private QuizTakingRepository quizTakingRepository;

    @Autowired
    private AttemptRepository attemptRepository;

    @Autowired
    private ClassroomRepository classroomRepository;

    @Autowired
    private QuizAssigningRepository quizAssigningRepository;

    @Autowired
    private UserAttemptAnswerRepository userAttemptAnswerRepository;

    @Autowired
    private AnswerRepository answerRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private ClassJoiningRepository classJoiningRepository;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private User studentA;
    private User studentB;

    @BeforeEach
    void setUp() {
        userAttemptAnswerRepository.deleteAllInBatch();
        attemptRepository.deleteAllInBatch();
        quizTakingRepository.deleteAllInBatch();
        answerRepository.deleteAllInBatch();
        jdbcTemplate.execute("delete from _question_creating");
        questionRepository.deleteAllInBatch();
        quizAssigningRepository.deleteAllInBatch();
        quizRepository.deleteAllInBatch();
        classJoiningRepository.deleteAllInBatch();
        classroomRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        studentA = new User();
        studentA.setEmail("studentA_" + UUID.randomUUID() + "@test.com");
        studentA.setRole(Role.STUDENT);
        studentA.setIsEnable(true);
        studentA.setIsVerified(true);
        studentA.setFullName("Student A");
        studentA.setPassword("password123");
        studentA = userRepository.save(studentA);

        studentB = new User();
        studentB.setEmail("studentB_" + UUID.randomUUID() + "@test.com");
        studentB.setRole(Role.STUDENT);
        studentB.setIsEnable(true);
        studentB.setIsVerified(true);
        studentB.setFullName("Student B");
        studentB.setPassword("password123");
        studentB = userRepository.save(studentB);

        Classroom classroom = new Classroom();
        classroom.setName("Test Class");
        classroom.setCode("CL" + UUID.randomUUID().toString().substring(0, 6));
        classroom.setIsEnable(true);
        classroom = classroomRepository.save(classroom);

        Quiz quiz = new Quiz();
        quiz.setTitle("Test Quiz");
        quiz.setIsDraft(false);
        quiz.setIsEnable(true);
        quiz.setIsExam(false);
        quiz.setCreator(studentA);
        quiz = quizRepository.save(quiz);

        QuizAssigning assigning = new QuizAssigning();
        assigning.setQuiz(quiz);
        assigning.setClassroom(classroom);
        assigning = quizAssigningRepository.save(assigning);

        // Student A taking assigned quiz
        QuizTaking takingA = new QuizTaking();
        takingA.setLearner(studentA);
        takingA.setQuiz(quiz);
        takingA.setQuizAssigning(assigning);
        takingA = quizTakingRepository.save(takingA);

        List<Attempt> attemptsA = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            Attempt a = new Attempt();
            a.setQuizTaking(takingA);
            a.setStartedAt(LocalDateTime.now().minusDays(100 - i)); // Newer is higher i
            a.setEndedAt(a.getStartedAt().plusMinutes(10));
            a.setResult(BigDecimal.valueOf(8.5));
            attemptsA.add(a);
        }
        attemptRepository.saveAll(attemptsA);

        // Student A taking personal quiz (no assigning)
        QuizTaking takingAPersonal = new QuizTaking();
        takingAPersonal.setLearner(studentA);
        takingAPersonal.setQuiz(quiz);
        takingAPersonal = quizTakingRepository.save(takingAPersonal);

        Attempt aPersonal = new Attempt();
        aPersonal.setQuizTaking(takingAPersonal);
        aPersonal.setStartedAt(LocalDateTime.now().plusDays(1)); // Newest
        aPersonal.setResult(BigDecimal.TEN);
        attemptRepository.save(aPersonal); // 101 total attempts for A

        // Student B taking assigned quiz
        QuizTaking takingB = new QuizTaking();
        takingB.setLearner(studentB);
        takingB.setQuiz(quiz);
        takingB.setQuizAssigning(assigning);
        takingB = quizTakingRepository.save(takingB);

        Attempt aB = new Attempt();
        aB.setQuizTaking(takingB);
        aB.setStartedAt(LocalDateTime.now());
        attemptRepository.save(aB); // 1 attempt for B
    }

    @Test
    void testPaginationAndQueryCount() {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);
        stats.clear();

        Page<QuizHistoryItemDTO> page0 = studentHomeService.getQuizHistoryPage(
                studentA.getEmail(), PageRequest.of(0, 20));
        
        long queryCountPage0 = stats.getPrepareStatementCount();
        System.out.println("Query count for page 0: " + queryCountPage0);
        
        assertThat(page0.getContent()).hasSize(20);
        assertThat(page0.getTotalElements()).isEqualTo(101);
        assertThat(page0.getTotalPages()).isEqualTo(6); // 101 / 20 = 5 with remainder -> 6 pages

        // check sorting (newest first)
        QuizHistoryItemDTO firstItem = page0.getContent().get(0);
        assertThat(firstItem.getQuizAssigningId()).isNull(); // personal attempt
        assertThat(firstItem.getResult()).isEqualByComparingTo(BigDecimal.TEN);
        
        for (int i = 0; i < page0.getContent().size() - 1; i++) {
            assertThat(page0.getContent().get(i).getStartedAt())
                .isAfterOrEqualTo(page0.getContent().get(i+1).getStartedAt());
        }

        stats.clear();
        Page<QuizHistoryItemDTO> page1 = studentHomeService.getQuizHistoryPage(
                studentA.getEmail(), PageRequest.of(1, 20));
        
        long queryCountPage1 = stats.getPrepareStatementCount();
        System.out.println("Query count for page 1: " + queryCountPage1);

        assertThat(page1.getContent()).hasSize(20);
        
        // Expected ~2 queries: 1 for content, 1 for count
        assertThat(queryCountPage0).isLessThan(10);
        assertThat(queryCountPage1).isLessThan(10);

        // Check assigned attempt in page 1
        QuizHistoryItemDTO assignedItem = page1.getContent().get(0);
        assertThat(assignedItem.getQuizAssigningId()).isNotNull();
        assertThat(assignedItem.getClassroomName()).isEqualTo("Test Class");
        assertThat(assignedItem.getQuizTitle()).isEqualTo("Test Quiz");
        
        // Ensure student B's attempts are isolated
        Page<QuizHistoryItemDTO> pageB = studentHomeService.getQuizHistoryPage(
                studentB.getEmail(), PageRequest.of(0, 20));
        assertThat(pageB.getTotalElements()).isEqualTo(1);
    }
}

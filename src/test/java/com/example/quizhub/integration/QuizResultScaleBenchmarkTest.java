package com.example.quizhub.integration;

import com.example.quizhub.dto.quiztaking.response.QuizResultResponseDTO;
import com.example.quizhub.dto.quiztaking.response.QuizResultResponseDTO.QuestionResultDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.entity.enums.TakingStatus;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.quiz.QuizTakingService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true"
})
@Testcontainers
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
public class QuizResultScaleBenchmarkTest {

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
    private UserAttemptAnswerRepository userAttemptAnswerRepository;
    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Autowired
    private EntityManager entityManager;

    private User teacher;
    private User student;
    private Classroom classroom;


    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private jakarta.persistence.EntityManagerFactory entityManagerFactory;

    private void runBenchmark(int questionCount) {
        // --- 1. CLEANUP OLD DATA ---
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

        // --- 2. CREATE ISOLATED FIXTURES ---
        User teacher = userRepository.save(User.builder()
                .email("teacher_result@test.com")
                .password("hashedpw")
                .fullName("Teacher Result")
                .isEnable(true)
                .isVerified(true)
                .role(Role.TEACHER).build());

        User student = userRepository.save(User.builder()
                .email("student_result@test.com")
                .password("hashedpw")
                .fullName("Student Result")
                .isEnable(true)
                .isVerified(true)
                .role(Role.STUDENT).build());

        Classroom classroom = classroomRepository.save(Classroom.builder()
                .name("Quiz Result Class")
                .creator(teacher)
                .code("QRC123")
                .isEnable(true)
                .build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom)
                .learner(student)
                .status(JoinStatus.APPROVED)
                .build());

        Long attemptId = transactionTemplate.execute(status -> {
            Quiz quiz = quizRepository.save(Quiz.builder()
                    .title("Result Scale Quiz " + questionCount)
                    .description("Scale Test")
                    .creator(teacher)
                    .isDraft(false)
                    .isEnable(true)
                    .isExam(false)
                    .build());

            List<Question> questions = new ArrayList<>();
            List<Answer> correctAnswers = new ArrayList<>();
            
            for (int i = 0; i < questionCount; i++) {
                Question question = questionRepository.save(Question.builder()
                        .text("Question " + i)
                        .type(QuestionType.SINGLE_CHOICE)
                        .build());
                questions.add(question);

                // 1 correct answer
                Answer correct = answerRepository.save(Answer.builder()
                        .question(question)
                        .text("Correct Answer " + i)
                        .isCorrect(true)
                        .build());
                correctAnswers.add(correct);

                // 3 incorrect answers
                for (int j = 0; j < 3; j++) {
                    answerRepository.save(Answer.builder()
                            .question(question)
                            .text("Wrong Answer " + i + "-" + j)
                            .isCorrect(false)
                            .build());
                }
            }
            
            quiz.setQuestions(questions);
            quizRepository.save(quiz);

            QuizAssigning assigning = quizAssigningRepository.save(QuizAssigning.builder()
                    .quiz(quiz)
                    .classroom(classroom)
                    .durationInMins(60)
                    .startDate(LocalDateTime.now().minusDays(1))
                    .dueDate(LocalDateTime.now().plusDays(1))
                    .isHidden(false)
                    .maxAttempt(1)
                    .showAnswer(true) // Ensure answers are returned
                    .build());

            QuizTaking taking = quizTakingRepository.save(QuizTaking.builder()
                    .learner(student)
                    .quiz(quiz)
                    .quizAssigning(assigning)
                    .isAssigned(true)
                    .status(TakingStatus.COMPLETED)
                    .build());

            Attempt attempt = attemptRepository.save(Attempt.builder()
                    .quizTaking(taking)
                    .startedAt(LocalDateTime.now().minusMinutes(30))
                    .endedAt(LocalDateTime.now().minusMinutes(5))
                    .result(BigDecimal.valueOf(10.0))
                    .correctNum(questionCount)
                    .incorrectNum(0)
                    .totalQuestNum(questionCount)
                    .build());

            // Create UserAttemptAnswer for each correct answer
            List<UserAttemptAnswer> userAnswers = new ArrayList<>();
            for (int i = 0; i < questionCount; i++) {
                userAnswers.add(UserAttemptAnswer.builder()
                        .attempt(attempt)
                        .question(questions.get(i))
                        .answer(correctAnswers.get(i))
                        .build());
            }
            userAttemptAnswerRepository.saveAll(userAnswers);
            
            return attempt.getId();
        });

        // --- 3. MEASUREMENT PREPARATION ---
        entityManager.clear();

        org.hibernate.stat.Statistics statistics = entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        
        long start = System.nanoTime();
        
        QuizResultResponseDTO result = transactionTemplate.execute(status -> 
            quizTakingService.getQuizResult(student.getId(), attemptId)
        );
        
        long end = System.nanoTime();

        long queries = statistics.getPrepareStatementCount();
        long ms = (end - start) / 1_000_000;

        System.out.printf("Questions: %3d | SQL Queries: %4d | Time: %5d ms%n", questionCount, queries, ms);

        // --- 4. ASSERTIONS ---
        assertThat(result).isNotNull();
        assertThat(result.getAttemptId()).isEqualTo(attemptId);
        assertThat(result.getTotalNum()).isEqualTo(questionCount);
        assertThat(result.getCorrectNum()).isEqualTo(questionCount);
        assertThat(result.getIncorrectNum()).isEqualTo(0);
        assertThat(result.getScore()).isEqualByComparingTo("10.00");
        assertThat(result.getQuestions()).hasSize(questionCount);

        for (QuestionResultDTO qDto : result.getQuestions()) {
            assertThat(qDto.getAnswers()).hasSize(4);
            assertThat(qDto.getSelectedAnswerIds()).hasSize(1);
            assertThat(qDto.getIsCorrect()).isTrue();
        }
    }

    @Test
    void benchmarkGetQuizResult() {
        System.out.println("Starting Benchmark for getQuizResult");
        System.out.println("--------------------------------------------------");
        runBenchmark(50);
        runBenchmark(100);
        runBenchmark(200);
        System.out.println("--------------------------------------------------");
    }
}

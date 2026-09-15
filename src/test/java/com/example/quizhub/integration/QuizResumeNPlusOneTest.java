package com.example.quizhub.integration;

import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.quiz.QuizTakingService;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class QuizResumeNPlusOneTest {

    private static final Logger log = LoggerFactory.getLogger(QuizResumeNPlusOneTest.class);

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

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
    private QuizTakingService quizTakingService;
    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private User student;

    @BeforeEach
    void setupTestFixture() {
        attemptRepository.deleteAllInBatch();
        quizTakingRepository.deleteAllInBatch();
        answerRepository.deleteAllInBatch();
        questionRepository.deleteAllInBatch();
        quizAssigningRepository.deleteAllInBatch();
        quizRepository.deleteAllInBatch();
        classJoiningRepository.deleteAllInBatch();
        classroomRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        student = userRepository.save(User.builder()
                .email("student1@example.com")
                .password("password")
                .fullName("Student 1")
                .role(Role.STUDENT)
                .isEnable(true)
                .isVerified(true)
                .build());
    }

    @Test
    void resumeShouldNotExhibitNPlusOneQueries() {
        // Setup 5 questions
        Attempt attempt5 = createQuizAndAttemptWithQuestions(5);
        
        // Setup 50 questions
        Attempt attempt50 = createQuizAndAttemptWithQuestions(50);

        SessionFactory sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);
        Statistics stats = sessionFactory.getStatistics();
        stats.setStatisticsEnabled(true);

        // Measure for 5 questions
        stats.clear();
        quizTakingService.getQuizTakingState(student.getId(), attempt5.getId());
        long queryCount5 = stats.getPrepareStatementCount();
        log.info("Query count for 5 questions: {}", queryCount5);

        // Measure for 50 questions
        stats.clear();
        quizTakingService.getQuizTakingState(student.getId(), attempt50.getId());
        long queryCount50 = stats.getPrepareStatementCount();
        log.info("Query count for 50 questions: {}", queryCount50);

        // Expectation: query count scales mostly by 0. 
        // We will accept a small difference (e.g., < 10) instead of growing by 45+.
        long difference = Math.abs(queryCount50 - queryCount5);
        log.info("Difference in query count: {}", difference);
        
        assertThat(difference).isLessThan(10);
    }

    private Attempt createQuizAndAttemptWithQuestions(int numQuestions) {
        Classroom classroom = classroomRepository.save(Classroom.builder()
                .code("CODE" + numQuestions)
                .name("Class " + numQuestions)
                .creator(student)
                .isEnable(true)
                .isDraft(false)
                .build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom)
                .learner(student)
                .status(JoinStatus.APPROVED)
                .build());

        Quiz quiz = quizRepository.save(Quiz.builder()
                .title("Quiz with " + numQuestions + " questions")
                .creator(student)
                .isDraft(false)
                .isEnable(true)
                .isExam(true)
                .build());

        java.util.List<Question> questions = new java.util.ArrayList<>();
        for (int i = 0; i < numQuestions; i++) {
            Question question = questionRepository.save(Question.builder()
                    .text("Question " + i)
                    .type(com.example.quizhub.entity.enums.QuestionType.SINGLE_CHOICE)
                    .creator(student)
                    .build());
            questions.add(question);

            for (int j = 0; j < 4; j++) {
                answerRepository.save(Answer.builder()
                        .question(question)
                        .text("Answer " + j)
                        .isCorrect(j == 0)
                        .build());
            }
        }
        
        quiz.setQuestions(questions);
        quizRepository.save(quiz);

        QuizAssigning assignedQuiz = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz)
                .classroom(classroom)
                .durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false)
                .build());

        return attemptRepository.findById(quizTakingService.startQuizAttempt(student.getId(), assignedQuiz.getId()).getAttemptId()).orElseThrow();
    }
}

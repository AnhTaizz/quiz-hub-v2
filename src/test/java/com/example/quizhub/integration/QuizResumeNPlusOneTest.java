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
        // We assert that 50 questions do not take significantly more queries than 5 questions.
        // Pre-fix behavior was 9 vs 11, which would fail this stricter assertion.
        long difference = Math.abs(queryCount50 - queryCount5);
        log.info("Difference in query count: {}", difference);
        
        assertThat(queryCount50).isLessThanOrEqualTo(queryCount5 + 1);
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

    @Test
    void resumePreservesSavedQuestionState() {
        // Create classroom and quiz
        Classroom classroom = classroomRepository.save(Classroom.builder()
                .code("STATE_CODE")
                .name("State Class")
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
                .title("State Quiz")
                .creator(student)
                .isDraft(false)
                .isEnable(true)
                .isExam(true)
                .build());

        // Create Question A (Choice)
        Question questionA = questionRepository.save(Question.builder()
                .text("Question A")
                .type(com.example.quizhub.entity.enums.QuestionType.SINGLE_CHOICE)
                .creator(student)
                .build());
                
        Answer answerA1 = answerRepository.save(Answer.builder()
                .question(questionA)
                .text("Choice 1")
                .isCorrect(true)
                .build());
        Answer answerA2 = answerRepository.save(Answer.builder()
                .question(questionA)
                .text("Choice 2")
                .isCorrect(false)
                .build());

        // Create Question B (Fill-in)
        Question questionB = questionRepository.save(Question.builder()
                .text("Question B")
                .type(com.example.quizhub.entity.enums.QuestionType.FILL_IN_BLANK)
                .creator(student)
                .build());
        
        Answer answerB1 = answerRepository.save(Answer.builder()
                .question(questionB)
                .text("Blank Answer")
                .isCorrect(true)
                .build());

        quiz.setQuestions(java.util.List.of(questionA, questionB));
        quizRepository.save(quiz);

        QuizAssigning assignedQuiz = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz)
                .classroom(classroom)
                .durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false)
                .build());

        // Start Quiz
        var startResponse = quizTakingService.startQuizAttempt(student.getId(), assignedQuiz.getId());
        Long attemptId = startResponse.getAttemptId();

        // Save state for Question A (Choice)
        quizTakingService.saveAnswer(student.getId(), attemptId, questionA.getId(),
                com.example.quizhub.dto.quiztaking.request.SaveAnswerRequestDTO.builder()
                        .answerIds(java.util.List.of(answerA2.getId()))
                        .revision(1L)
                        .build());

        // Save state for Question B (Fill-in)
        quizTakingService.saveAnswer(student.getId(), attemptId, questionB.getId(),
                com.example.quizhub.dto.quiztaking.request.SaveAnswerRequestDTO.builder()
                        .selectedText("My Answer")
                        .revision(2L)
                        .build());

        // Resume (get state)
        var state = quizTakingService.getQuizTakingState(student.getId(), attemptId);

        // Assertions
        assertThat(state.getQuestions()).hasSize(2);
        
        // Find returned questions
        var qA = state.getQuestions().stream().filter(q -> q.getId().equals(questionA.getId())).findFirst().orElseThrow();
        var qB = state.getQuestions().stream().filter(q -> q.getId().equals(questionB.getId())).findFirst().orElseThrow();
        
        assertThat(qA.getAnswers()).hasSize(2);
        assertThat(qB.getAnswers()).hasSize(1);
        
        // Assert choice state
        assertThat(state.getSelectedAnswers()).containsEntry(questionA.getId(), java.util.List.of(answerA2.getId()));
        assertThat(state.getAnswerRevisions()).containsEntry(questionA.getId(), 1L);
        
        // Assert fill-in state
        assertThat(state.getSelectedTexts()).containsEntry(questionB.getId(), "My Answer");
        assertThat(state.getAnswerRevisions()).containsEntry(questionB.getId(), 2L);
    }
}

package com.example.quizhub.integration;

import com.example.quizhub.dto.quiztaking.response.QuizResultResponseDTO;
import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.entity.enums.Role;
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

/**
 * Proves getQuizResult's answer-visibility policy is correct at its edges:
 * a missing dueDate must never be treated as "the deadline already passed".
 */
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class QuizResultVisibilitySecurityIntegrationTest {

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

    private User teacher;
    private User student;
    private Classroom classroom;
    private Question question;
    private Answer correctAnswer;

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
                .email("teacher_vis@test.com").password("pw").fullName("Teacher")
                .isEnable(true).isVerified(true).role(Role.TEACHER).build());

        student = userRepository.save(User.builder()
                .email("student_vis@test.com").password("pw").fullName("Student")
                .isEnable(true).isVerified(true).role(Role.STUDENT).build());

        classroom = classroomRepository.save(Classroom.builder()
                .name("Visibility Class").creator(teacher).code("VIS123").isEnable(true).build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom).learner(student).status(JoinStatus.APPROVED).build());
    }

    private QuizAssigning assignQuiz(Boolean showAnswer, LocalDateTime dueDate) {
        Quiz quiz = quizRepository.save(Quiz.builder()
                .title("Visibility Quiz").creator(teacher).isDraft(false).isEnable(true).isExam(false).build());

        question = questionRepository.save(Question.builder().text("Q?").type(QuestionType.SINGLE_CHOICE).build());
        quiz.setQuestions(List.of(question));
        quizRepository.save(quiz);

        correctAnswer = answerRepository.save(Answer.builder().question(question).text("Correct").isCorrect(true).build());
        answerRepository.save(Answer.builder().question(question).text("Wrong").isCorrect(false).build());

        return quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz).classroom(classroom).durationInMins(60)
                .startDate(LocalDateTime.now().minusDays(2))
                .dueDate(dueDate)
                .isHidden(false)
                .showAnswer(showAnswer)
                .build());
    }

    private Long completeAttempt(QuizAssigning assigning) {
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(student.getId(), assigning.getId());
        Long attemptId = startRes.getAttemptId();

        Attempt attempt = attemptRepository.findById(attemptId).orElseThrow();
        attempt.setEndedAt(LocalDateTime.now());
        attempt.setCorrectNum(1);
        attempt.setIncorrectNum(0);
        attemptRepository.save(attempt);

        return attemptId;
    }

    @Test
    void futureDeadlineWithShowAnswerFalseHidesAnswers() {
        QuizAssigning assigning = assignQuiz(false, LocalDateTime.now().plusDays(1));
        Long attemptId = completeAttempt(assigning);

        QuizResultResponseDTO result = quizTakingService.getQuizResult(student.getId(), attemptId);

        assertThat(result.getQuestions()).isEmpty();
        assertThat(result.getCorrectNum()).isNull();
        assertThat(result.getIncorrectNum()).isNull();
    }

    @Test
    void nullDeadlineWithShowAnswerFalseDoesNotLeakAnswers() {
        // Regression guard: a missing dueDate must NOT be treated as "deadline already passed".
        QuizAssigning assigning = assignQuiz(false, null);
        Long attemptId = completeAttempt(assigning);

        QuizResultResponseDTO result = quizTakingService.getQuizResult(student.getId(), attemptId);

        assertThat(result.getQuestions()).isEmpty();
        assertThat(result.getCorrectNum()).isNull();
        assertThat(result.getIncorrectNum()).isNull();
    }

    @Test
    void pastDeadlineRevealsAnswers() {
        // Assign with a future deadline so the attempt can be started, then simulate the
        // deadline having since passed (starting an attempt against an already-past deadline
        // is itself rejected by validateQuizSchedule, so the deadline must move AFTER start).
        QuizAssigning assigning = assignQuiz(false, LocalDateTime.now().plusDays(1));
        Long attemptId = completeAttempt(assigning);

        assigning.setDueDate(LocalDateTime.now().minusHours(1));
        quizAssigningRepository.save(assigning);

        QuizResultResponseDTO result = quizTakingService.getQuizResult(student.getId(), attemptId);

        assertThat(result.getQuestions()).hasSize(1);
        assertThat(result.getCorrectNum()).isNotNull();
        assertThat(result.getIncorrectNum()).isNotNull();
    }

    @Test
    void showAnswerTrueRevealsAnswersRegardlessOfFutureDeadline() {
        QuizAssigning assigning = assignQuiz(true, LocalDateTime.now().plusDays(1));
        Long attemptId = completeAttempt(assigning);

        QuizResultResponseDTO result = quizTakingService.getQuizResult(student.getId(), attemptId);

        assertThat(result.getQuestions()).hasSize(1);
        assertThat(result.getCorrectNum()).isNotNull();
        assertThat(result.getIncorrectNum()).isNotNull();
    }

    @Test
    void personalQuizResultAlwaysRevealsAnswers() {
        Quiz quiz = quizRepository.save(Quiz.builder()
                .title("Personal Quiz").creator(teacher).isDraft(false).isEnable(true).isExam(false).build());

        Question q = questionRepository.save(Question.builder().text("Personal Q?").type(QuestionType.SINGLE_CHOICE).build());
        quiz.setQuestions(List.of(q));
        quizRepository.save(quiz);

        answerRepository.save(Answer.builder().question(q).text("Correct").isCorrect(true).build());
        answerRepository.save(Answer.builder().question(q).text("Wrong").isCorrect(false).build());

        QuizTakingResponseDTO startRes = quizTakingService.startPersonalQuizAttempt(student.getId(), quiz.getId().toString());
        Long attemptId = startRes.getAttemptId();

        Attempt attempt = attemptRepository.findById(attemptId).orElseThrow();
        attempt.setEndedAt(LocalDateTime.now());
        attempt.setCorrectNum(1);
        attempt.setIncorrectNum(0);
        attemptRepository.save(attempt);

        QuizResultResponseDTO result = quizTakingService.getQuizResult(student.getId(), attemptId);

        assertThat(result.getQuestions()).hasSize(1);
        assertThat(result.getCorrectNum()).isNotNull();
        assertThat(result.getIncorrectNum()).isNotNull();
    }
}

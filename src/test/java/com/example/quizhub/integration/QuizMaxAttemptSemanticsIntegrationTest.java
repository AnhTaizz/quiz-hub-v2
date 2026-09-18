package com.example.quizhub.integration;

import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.entity.enums.TakingStatus;
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
 * Proves maxAttempt semantics are consistent with the rest of the codebase
 * (QuizAssigningServiceImpl, StudentHomeServiceImpl): null or <= 0 means
 * unlimited attempts, a positive value is a hard cap.
 */
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class QuizMaxAttemptSemanticsIntegrationTest {

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
    private Classroom classroom;
    private User teacher;

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
                .email("teacher_max@test.com").password("pw").fullName("Teacher")
                .isEnable(true).isVerified(true).role(Role.TEACHER).build());

        student = userRepository.save(User.builder()
                .email("student_max@test.com").password("pw").fullName("Student")
                .isEnable(true).isVerified(true).role(Role.STUDENT).build());

        classroom = classroomRepository.save(Classroom.builder()
                .name("Max Attempt Class").creator(teacher).code("MAX123").isEnable(true).build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom).learner(student).status(JoinStatus.APPROVED).build());
    }

    private QuizAssigning assignQuizWithMaxAttempt(Integer maxAttempt) {
        Quiz quiz = quizRepository.save(Quiz.builder()
                .title("Max Attempt Quiz " + maxAttempt).creator(teacher)
                .isDraft(false).isEnable(true).isExam(false).build());

        Question question = questionRepository.save(Question.builder()
                .text("Q?").type(QuestionType.SINGLE_CHOICE).build());
        quiz.setQuestions(List.of(question));
        quizRepository.save(quiz);

        answerRepository.save(Answer.builder().question(question).text("A").isCorrect(true).build());

        return quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz).classroom(classroom).durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false)
                .maxAttempt(maxAttempt)
                .build());
    }

    private void completeCurrentAttempt(QuizAssigning assigning) {
        QuizTaking taking = quizTakingRepository
                .findByLearnerIdAndQuizAssigningId(student.getId(), assigning.getId()).orElseThrow();
        Attempt attempt = attemptRepository.findByQuizTakingId(taking.getId()).stream()
                .filter(a -> a.getEndedAt() == null)
                .findFirst().orElseThrow();
        attempt.setEndedAt(LocalDateTime.now());
        attemptRepository.save(attempt);
        taking.setStatus(TakingStatus.COMPLETED);
        quizTakingRepository.save(taking);
    }

    @Test
    void maxAttemptZeroBehavesAsUnlimited() {
        QuizAssigning assigning = assignQuizWithMaxAttempt(0);

        QuizTakingResponseDTO res1 = quizTakingService.startQuizAttempt(student.getId(), assigning.getId());
        completeCurrentAttempt(assigning);

        QuizTakingResponseDTO res2 = quizTakingService.startQuizAttempt(student.getId(), assigning.getId());
        completeCurrentAttempt(assigning);

        QuizTakingResponseDTO res3 = quizTakingService.startQuizAttempt(student.getId(), assigning.getId());

        assertThat(res1.getAttemptId()).isNotNull();
        assertThat(res2.getAttemptId()).isNotEqualTo(res1.getAttemptId());
        assertThat(res3.getAttemptId()).isNotEqualTo(res2.getAttemptId());
    }

    @Test
    void maxAttemptNullBehavesAsUnlimited() {
        QuizAssigning assigning = assignQuizWithMaxAttempt(null);

        quizTakingService.startQuizAttempt(student.getId(), assigning.getId());
        completeCurrentAttempt(assigning);

        quizTakingService.startQuizAttempt(student.getId(), assigning.getId());
        completeCurrentAttempt(assigning);

        QuizTakingResponseDTO res3 = quizTakingService.startQuizAttempt(student.getId(), assigning.getId());
        assertThat(res3.getAttemptId()).isNotNull();
    }

    @Test
    void positiveMaxAttemptIsStillEnforced() {
        QuizAssigning assigning = assignQuizWithMaxAttempt(2);

        quizTakingService.startQuizAttempt(student.getId(), assigning.getId());
        completeCurrentAttempt(assigning);

        quizTakingService.startQuizAttempt(student.getId(), assigning.getId());
        completeCurrentAttempt(assigning);

        AppException ex = assertThrows(AppException.class,
                () -> quizTakingService.startQuizAttempt(student.getId(), assigning.getId()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.MAX_ATTEMPTS_REACHED);
    }
}

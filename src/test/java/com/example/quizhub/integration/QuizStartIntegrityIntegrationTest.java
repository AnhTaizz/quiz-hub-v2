package com.example.quizhub.integration;

import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.entity.enums.TakingStatus;
import com.example.quizhub.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class QuizStartIntegrityIntegrationTest {

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
    private QuizAssigningRepository quizAssigningRepository;
    @Autowired
    private AttemptRepository attemptRepository;
    @Autowired
    private QuizTakingRepository quizTakingRepository;

    private User student;
    private Quiz quiz;
    private QuizAssigning assignedQuiz;

    @BeforeEach
    void setupTestFixture() {
        attemptRepository.deleteAllInBatch();
        quizTakingRepository.deleteAllInBatch();
        quizAssigningRepository.deleteAllInBatch();
        quizRepository.deleteAllInBatch();
        classJoiningRepository.deleteAllInBatch();
        classroomRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        User teacher = userRepository.save(User.builder()
                .email("teacher@test.com")
                .password("hashedpw")
                .fullName("Teacher")
                .isEnable(true)
                .isVerified(true)
                .role(Role.TEACHER).build());

        student = userRepository.save(User.builder()
                .email("student@test.com")
                .password("hashedpw")
                .fullName("Student")
                .isEnable(true)
                .isVerified(true)
                .role(Role.STUDENT).build());

        Classroom classroom = classroomRepository.save(Classroom.builder()
                .name("Test Class")
                .creator(teacher)
                .code("CODE123")
                .isEnable(true)
                .build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom)
                .learner(student)
                .status(JoinStatus.APPROVED)
                .build());

        quiz = quizRepository.save(Quiz.builder()
                .title("Integrity Quiz")
                .creator(teacher)
                .isDraft(false)
                .isEnable(true)
                .isExam(false)
                .build());

        assignedQuiz = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz)
                .classroom(classroom)
                .durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false)
                .build());
    }

    @Test
    void databaseShouldRejectDuplicateAssignedQuizTaking() {
        // [TEST Q] - duplicate QuizTaking is currently possible
        // Desired invariant: For one assigned quiz, (student, assigning) must map to at most ONE QuizTaking.

        QuizTaking taking1 = QuizTaking.builder()
                .isAssigned(true)
                .status(TakingStatus.NOT_STARTED)
                .quiz(quiz)
                .quizAssigning(assignedQuiz)
                .learner(student)
                .build();
        quizTakingRepository.saveAndFlush(taking1);

        QuizTaking taking2 = QuizTaking.builder()
                .isAssigned(true)
                .status(TakingStatus.NOT_STARTED)
                .quiz(quiz)
                .quizAssigning(assignedQuiz)
                .learner(student)
                .build();

        // The current DB schema is expected to ALLOW this, meaning this assertThrows will FAIL (RED).
        assertThrows(DataIntegrityViolationException.class, () -> {
            quizTakingRepository.saveAndFlush(taking2);
        });
    }

    @Test
    void databaseShouldRejectMultipleActiveAttemptsForSameQuizTaking() {
        // [TEST A] - multiple active attempts are currently possible
        // Desired invariant: For one QuizTaking, there must be at most ONE unfinished Attempt (ended_at IS NULL).

        QuizTaking taking = QuizTaking.builder()
                .isAssigned(true)
                .status(TakingStatus.NOT_STARTED)
                .quiz(quiz)
                .quizAssigning(assignedQuiz)
                .learner(student)
                .build();
        taking = quizTakingRepository.saveAndFlush(taking);

        Attempt attempt1 = Attempt.builder()
                .quizTaking(taking)
                .startedAt(LocalDateTime.now())
                .totalQuestNum(10)
                .endedAt(null) // Active
                .build();
        attemptRepository.saveAndFlush(attempt1);

        Attempt attempt2 = Attempt.builder()
                .quizTaking(taking)
                .startedAt(LocalDateTime.now())
                .totalQuestNum(10)
                .endedAt(null) // Active
                .build();

        // The current DB schema is expected to ALLOW this, meaning this assertThrows will FAIL (RED).
        assertThrows(DataIntegrityViolationException.class, () -> {
            attemptRepository.saveAndFlush(attempt2);
        });
    }
}

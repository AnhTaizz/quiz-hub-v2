package com.example.quizhub.integration;

import com.example.quizhub.dto.quiztaking.request.ViolationRequestDTO;
import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.dto.quiztaking.response.ViolationResponseDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.quiz.QuizTakingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
public class QuizViolationSecurityIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired
    private QuizTakingService quizTakingService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private QuizRepository quizRepository;
    @Autowired
    private QuizAssigningRepository quizAssigningRepository;
    @Autowired
    private ClassroomRepository classroomRepository;
    @Autowired
    private ClassJoiningRepository classJoiningRepository;
    @Autowired
    private AttemptViolationRepository attemptViolationRepository;
    @Autowired
    private AttemptRepository attemptRepository;
    @Autowired
    private QuizTakingRepository quizTakingRepository;

    private User studentA;
    private User studentB;
    private QuizAssigning assignedQuiz;
    private Long attemptIdA;

    @BeforeEach
    void setup() {
        attemptViolationRepository.deleteAllInBatch();
        attemptRepository.deleteAllInBatch();
        quizTakingRepository.deleteAllInBatch();
        quizAssigningRepository.deleteAllInBatch();
        quizRepository.deleteAllInBatch();
        classJoiningRepository.deleteAllInBatch();
        classroomRepository.deleteAllInBatch();
        userRepository.deleteAllInBatch();

        User teacher = userRepository.save(User.builder().email("teacher@test.com").password("pass").fullName("Teacher").isEnable(true).isVerified(true).role(Role.TEACHER).build());
        studentA = userRepository.save(User.builder().email("studentA@test.com").password("pass").fullName("A").isEnable(true).isVerified(true).role(Role.STUDENT).build());
        studentB = userRepository.save(User.builder().email("studentB@test.com").password("pass").fullName("B").isEnable(true).isVerified(true).role(Role.STUDENT).build());

        Classroom classroom = classroomRepository.save(Classroom.builder().name("Class 1").creator(teacher).code("CODE").isEnable(true).build());
        classJoiningRepository.save(ClassJoining.builder().classroom(classroom).learner(studentA).status(JoinStatus.APPROVED).build());
        classJoiningRepository.save(ClassJoining.builder().classroom(classroom).learner(studentB).status(JoinStatus.APPROVED).build());

        Quiz quiz = quizRepository.save(Quiz.builder().title("Quiz").creator(teacher).isDraft(false).isEnable(true).isExam(false).build());

        assignedQuiz = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz)
                .classroom(classroom)
                .durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false)
                .build());

        QuizTakingResponseDTO response = quizTakingService.startQuizAttempt(studentA.getId(), assignedQuiz.getId());
        attemptIdA = response.getAttemptId();
    }

    @Test
    void studentCannotLogViolationForAnotherStudentsAttempt() {
        ViolationRequestDTO request = new ViolationRequestDTO();
        request.setAttemptId(attemptIdA);
        request.setViolationCode("TAB_SWITCH");
        
        long countBefore = attemptViolationRepository.count();

        // B tries to log violation on A's attempt
        AppException exception = assertThrows(AppException.class, 
            () -> quizTakingService.recordViolation(studentB.getId(), request));
            
        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED);
        assertThat(attemptViolationRepository.count()).isEqualTo(countBefore);
    }

    @Test
    void ownerCanLogViolationForOwnAttempt() {
        ViolationRequestDTO request = new ViolationRequestDTO();
        request.setAttemptId(attemptIdA);
        request.setViolationCode("TAB_SWITCH");

        ViolationResponseDTO response = quizTakingService.recordViolation(studentA.getId(), request);
        
        assertThat(response).isNotNull();
        assertThat(response.getViolationCount()).isEqualTo(1);
        assertThat(response.isAutoSubmitted()).isFalse();

        long count = attemptViolationRepository.countByAttemptId(attemptIdA);
        assertThat(count).isEqualTo(1);
    }

    @Test
    void studentCannotReadViolationStateOfAnotherStudentsCompletedAttempt() {
        // A submits their attempt
        Attempt attempt = attemptRepository.findById(attemptIdA).orElseThrow();
        attempt.setEndedAt(LocalDateTime.now());
        attemptRepository.save(attempt);

        ViolationRequestDTO request = new ViolationRequestDTO();
        request.setAttemptId(attemptIdA);
        request.setViolationCode("TAB_SWITCH");

        // B tries to log/read violation on A's completed attempt
        AppException exception = assertThrows(AppException.class, 
            () -> quizTakingService.recordViolation(studentB.getId(), request));
            
        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    void unknownAttempt() {
        ViolationRequestDTO request = new ViolationRequestDTO();
        request.setAttemptId(99999L);
        request.setViolationCode("TAB_SWITCH");

        AppException exception = assertThrows(AppException.class, 
            () -> quizTakingService.recordViolation(studentA.getId(), request));
            
        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ATTEMPT_NOT_FOUND);
    }
}

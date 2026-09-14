package com.example.quizhub.integration;

import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.quiz.QuizTakingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class ConcurrentQuizStartIntegrationTest {

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
    private CategoryRepository categoryRepository;
    @Autowired
    private QuizRepository quizRepository;
    @Autowired
    private QuizAssigningRepository quizAssigningRepository;
    @Autowired
    private QuizTakingRepository quizTakingRepository;
    @Autowired
    private AttemptRepository attemptRepository;

    private User student;
    private QuizAssigning quizAssigning;

    @BeforeEach
    void setup() {
        attemptRepository.deleteAll();
        quizTakingRepository.deleteAll();
        quizAssigningRepository.deleteAll();
        quizRepository.deleteAll();
        categoryRepository.deleteAll();
        classJoiningRepository.deleteAll();
        classroomRepository.deleteAll();
        userRepository.deleteAll();

        student = userRepository.save(User.builder()
                .email("student@example.com")
                .password("password")
                .fullName("Student")
                .role(Role.STUDENT)
                .isEnable(true)
                .isVerified(true)
                .build());

        User teacher = userRepository.save(User.builder()
                .email("teacher@example.com")
                .password("password")
                .fullName("Teacher")
                .role(Role.TEACHER)
                .isEnable(true)
                .isVerified(true)
                .build());

        Classroom classroom = classroomRepository.save(Classroom.builder()
                .name("Test Class")
                .code("CODE1234")
                .creator(teacher)
                .isEnable(true)
                .isDeleted(false)
                .build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom)
                .learner(student)
                .status(com.example.quizhub.entity.enums.JoinStatus.APPROVED)
                .joinedAt(LocalDateTime.now())
                .build());

        Category category = categoryRepository.save(Category.builder()
                .name("Math")
                .creator(teacher)
                .build());

        Quiz quiz = quizRepository.save(Quiz.builder()
                .title("Math Quiz")
                .creator(teacher)
                .category(category)
                .isEnable(true)
                .isExam(true)
                .isDraft(false)
                .build());

        quizAssigning = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz)
                .classroom(classroom)
                .startDate(LocalDateTime.now().minusDays(1))
                .dueDate(LocalDateTime.now().plusDays(1))
                .assignedStudentIds(String.valueOf(student.getId()))
                .maxAttempt(5)
                .durationInMins(30)
                .build());
    }

    @Test
    void concurrentStartReturnsSameAttempt() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch latch = new CountDownLatch(1);

        Future<QuizTakingResponseDTO> future1 = executor.submit(() -> {
            latch.await();
            return quizTakingService.startQuizAttempt(student.getId(), quizAssigning.getId());
        });

        Future<QuizTakingResponseDTO> future2 = executor.submit(() -> {
            latch.await();
            return quizTakingService.startQuizAttempt(student.getId(), quizAssigning.getId());
        });

        // Release latch to start both simultaneously
        latch.countDown();

        try {
            QuizTakingResponseDTO response1 = future1.get(10, TimeUnit.SECONDS);
            QuizTakingResponseDTO response2 = future2.get(10, TimeUnit.SECONDS);

            assertThat(response1.getAttemptId()).isEqualTo(response2.getAttemptId());
            
            long takingCount = quizTakingRepository.count();
            assertThat(takingCount).isEqualTo(1);

            long attemptCount = attemptRepository.count();
            assertThat(attemptCount).isEqualTo(1);

            Attempt attempt = attemptRepository.findAll().get(0);
            assertThat(attempt.getEndedAt()).isNull();
            QuizTaking taking = quizTakingRepository.findAll().get(0);
            assertThat(taking.getStatus().name()).isEqualTo("IN_PROGRESS");
        } finally {
            executor.shutdownNow();
        }
    }
}

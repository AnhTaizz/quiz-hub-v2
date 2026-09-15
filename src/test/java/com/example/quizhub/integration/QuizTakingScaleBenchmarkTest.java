package com.example.quizhub.integration;

import com.example.quizhub.dto.quiztaking.request.QuestionSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.request.QuizSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.request.SaveAnswerRequestDTO;
import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.quiz.QuizTakingService;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import jakarta.persistence.EntityManagerFactory;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class QuizTakingScaleBenchmarkTest {

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
    private EntityManagerFactory entityManagerFactory;

    private User teacher;
    private Classroom classroom;

    @BeforeEach
    void setupGlobal() {
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
                .email("teacher_scale@test.com")
                .password("hashedpw")
                .fullName("Teacher Scale")
                .isEnable(true)
                .isVerified(true)
                .role(Role.TEACHER).build());

        classroom = classroomRepository.save(Classroom.builder()
                .name("Scale Test Class")
                .creator(teacher)
                .code("SCL123")
                .isEnable(true)
                .build());
    }

    private static class BenchmarkResult {
        long startQueries;
        long startMs;
        long autosaveQueries;
        long autosaveMs;
        long resumeQueries;
        long resumeMs;
        long submitQueries;
        long submitMs;
    }

    @Test
    void runScaleBenchmark() {
        BenchmarkResult q50 = measureQuiz(50);
        BenchmarkResult q100 = measureQuiz(100);
        BenchmarkResult q200 = measureQuiz(200);

        System.out.println("Quiz Scale Benchmark");
        System.out.println("Operation | 50Q | 100Q | 200Q");
        System.out.println("--------------------------------");
        System.out.printf("START queries\t%d\t%d\t%d\n", q50.startQueries, q100.startQueries, q200.startQueries);
        System.out.printf("START ms\t%d\t%d\t%d\n\n", q50.startMs, q100.startMs, q200.startMs);
        System.out.printf("AUTOSAVE queries\t%d\t%d\t%d\n", q50.autosaveQueries, q100.autosaveQueries, q200.autosaveQueries);
        System.out.printf("AUTOSAVE ms\t%d\t%d\t%d\n\n", q50.autosaveMs, q100.autosaveMs, q200.autosaveMs);
        System.out.printf("RESUME queries\t%d\t%d\t%d\n", q50.resumeQueries, q100.resumeQueries, q200.resumeQueries);
        System.out.printf("RESUME ms\t%d\t%d\t%d\n\n", q50.resumeMs, q100.resumeMs, q200.resumeMs);
        System.out.printf("SUBMIT queries\t%d\t%d\t%d\n", q50.submitQueries, q100.submitQueries, q200.submitQueries);
        System.out.printf("SUBMIT ms\t%d\t%d\t%d\n\n", q50.submitMs, q100.submitMs, q200.submitMs);

        // Automated Invariants
        // Start Query Count should remain approx constant
        assertThat(q200.startQueries).isLessThanOrEqualTo(q50.startQueries + 2);

        // Resume Query Count should remain approx constant
        assertThat(q200.resumeQueries).isLessThanOrEqualTo(q50.resumeQueries + 5);

        // Autosave Query Count should remain approx constant
        assertThat(q200.autosaveQueries).isLessThanOrEqualTo(q50.autosaveQueries + 2);
    }

    private BenchmarkResult measureQuiz(int questionCount) {
        User student = userRepository.save(User.builder()
                .email("student_" + questionCount + "@test.com")
                .password("hashedpw")
                .fullName("Student " + questionCount)
                .isEnable(true)
                .isVerified(true)
                .role(Role.STUDENT).build());

        classJoiningRepository.save(ClassJoining.builder()
                .classroom(classroom)
                .learner(student)
                .status(JoinStatus.APPROVED)
                .build());

        Quiz quiz = quizRepository.save(Quiz.builder()
                .title("Scale Quiz " + questionCount)
                .description("Testing scale")
                .creator(teacher)
                .isDraft(false)
                .isEnable(true)
                .isExam(false)
                .build());

        List<Question> questions = new ArrayList<>();
        List<Answer> answersToSave = new ArrayList<>();
        for (int i = 0; i < questionCount; i++) {
            Question q = Question.builder()
                    .text("Question " + i)
                    .type(QuestionType.SINGLE_CHOICE)
                    .build();
            questions.add(q);
        }
        questionRepository.saveAll(questions);
        quiz.setQuestions(questions);
        quizRepository.save(quiz);

        for (Question q : questions) {
            for (int j = 0; j < 4; j++) {
                answersToSave.add(Answer.builder()
                        .question(q)
                        .text("Answer " + j)
                        .isCorrect(j == 0)
                        .build());
            }
        }
        answerRepository.saveAll(answersToSave);

        QuizAssigning assignedQuiz = quizAssigningRepository.save(QuizAssigning.builder()
                .quiz(quiz)
                .classroom(classroom)
                .durationInMins(60)
                .startDate(LocalDateTime.now().minusMinutes(5))
                .dueDate(LocalDateTime.now().plusDays(1))
                .isHidden(false)
                .build());

        BenchmarkResult res = new BenchmarkResult();
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.setStatisticsEnabled(true);

        // 1. Measure START
        stats.clear();
        long t1 = System.nanoTime();
        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(student.getId(), assignedQuiz.getId());
        res.startMs = (System.nanoTime() - t1) / 1000000;
        res.startQueries = stats.getPrepareStatementCount();
        
        assertThat(startRes.getQuestions())
                .hasSize(questionCount)
                .allSatisfy(question -> 
                        assertThat(question.getAnswers()).hasSize(4)
                );
        Long attemptId = startRes.getAttemptId();
        assertThat(attemptId).isNotNull();

        // 2. Measure AUTOSAVE
        SaveAnswerRequestDTO saveReq = new SaveAnswerRequestDTO();
        saveReq.setAnswerIds(List.of(startRes.getQuestions().get(0).getAnswers().get(0).getId()));
        saveReq.setRevision(1L);

        stats.clear();
        long t2 = System.nanoTime();
        quizTakingService.saveAnswer(student.getId(), attemptId, startRes.getQuestions().get(0).getId(), saveReq);
        res.autosaveMs = (System.nanoTime() - t2) / 1000000;
        res.autosaveQueries = stats.getPrepareStatementCount();

        // 3. Measure RESUME
        stats.clear();
        long t3 = System.nanoTime();
        QuizTakingResponseDTO stateRes = quizTakingService.getQuizTakingState(student.getId(), attemptId);
        res.resumeMs = (System.nanoTime() - t3) / 1000000;
        res.resumeQueries = stats.getPrepareStatementCount();

        assertThat(stateRes.getAttemptId()).isEqualTo(attemptId);
        assertThat(stateRes.getQuestions()).hasSize(questionCount);

        // 4. Measure SUBMIT
        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(startRes.getQuestions().get(0).getId());
        qSubmit.setAnswerIds(saveReq.getAnswerIds());
        qSubmit.setRevision(1L);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        stats.clear();
        long t4 = System.nanoTime();
        quizTakingService.submitQuizAttempt(student.getId(), submitReq);
        res.submitMs = (System.nanoTime() - t4) / 1000000;
        res.submitQueries = stats.getPrepareStatementCount();

        return res;
    }
}

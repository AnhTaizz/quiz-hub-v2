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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import jakarta.persistence.EntityManagerFactory;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
    "spring.jpa.properties.hibernate.session_factory.statement_inspector=com.example.quizhub.integration.SqlCaptureInspector"
})
@Testcontainers
public class QuizSubmitSqlTraceTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired private QuizTakingService quizTakingService;
    @Autowired private UserRepository userRepository;
    @Autowired private ClassroomRepository classroomRepository;
    @Autowired private ClassJoiningRepository classJoiningRepository;
    @Autowired private QuizRepository quizRepository;
    @Autowired private QuestionRepository questionRepository;
    @Autowired private AnswerRepository answerRepository;
    @Autowired private QuizAssigningRepository quizAssigningRepository;
    @Autowired private AttemptRepository attemptRepository;
    @Autowired private QuizTakingRepository quizTakingRepository;
    @Autowired private UserAttemptAnswerRepository userAttemptAnswerRepository;
    @Autowired private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Autowired private EntityManagerFactory entityManagerFactory;

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
                .email("teacher_trace@test.com")
                .password("hashedpw")
                .fullName("Teacher Trace")
                .isEnable(true)
                .isVerified(true)
                .role(Role.TEACHER).build());

        classroom = classroomRepository.save(Classroom.builder()
                .name("Trace Test Class")
                .creator(teacher)
                .code("TRC123")
                .isEnable(true)
                .build());
    }

    private String normalizeSql(String sql) {
        String s = sql.trim().replaceAll("\\s+", " ");
        s = s.replaceAll("[$]\\d+", "?"); // PostgreSQL parameters
        return s;
    }

    @Test
    void traceSubmitScaling() {
        Map<String, Long> q50 = traceSubmit(50);
        Map<String, Long> q100 = traceSubmit(100);
        Map<String, Long> q200 = traceSubmit(200);

        Set<String> allSql = new TreeSet<>(q50.keySet());
        allSql.addAll(q100.keySet());
        allSql.addAll(q200.keySet());

        System.out.println("SQL template | 50Q | 100Q | 200Q");
        System.out.println("----------------------------------------------------------");
        for (String sql : allSql) {
            long count50 = q50.getOrDefault(sql, 0L);
            long count100 = q100.getOrDefault(sql, 0L);
            long count200 = q200.getOrDefault(sql, 0L);
            System.out.printf("%-45s | %4d | %4d | %4d\n", 
                sql.substring(0, Math.min(sql.length(), 45)), count50, count100, count200);
            if (sql.length() > 45) {
                System.out.println("  " + sql);
            }
        }
        
        long total50 = q50.values().stream().mapToLong(Long::longValue).sum();
        long total100 = q100.values().stream().mapToLong(Long::longValue).sum();
        long total200 = q200.values().stream().mapToLong(Long::longValue).sum();
        System.out.printf("TOTALS | %4d | %4d | %4d\n", total50, total100, total200);
    }

    private Map<String, Long> traceSubmit(int questionCount) {
        User student = userRepository.save(User.builder()
                .email("student_trace_" + questionCount + "@test.com")
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
                .title("Trace Quiz " + questionCount)
                .description("Testing trace")
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

        QuizTakingResponseDTO startRes = quizTakingService.startQuizAttempt(student.getId(), assignedQuiz.getId());
        Long attemptId = startRes.getAttemptId();

        SaveAnswerRequestDTO saveReq = new SaveAnswerRequestDTO();
        saveReq.setAnswerIds(List.of(startRes.getQuestions().get(0).getAnswers().get(0).getId()));
        saveReq.setRevision(1L);
        quizTakingService.saveAnswer(student.getId(), attemptId, startRes.getQuestions().get(0).getId(), saveReq);

        quizTakingService.getQuizTakingState(student.getId(), attemptId);

        QuestionSubmitRequestDTO qSubmit = new QuestionSubmitRequestDTO();
        qSubmit.setQuestionId(startRes.getQuestions().get(0).getId());
        qSubmit.setAnswerIds(saveReq.getAnswerIds());
        qSubmit.setRevision(1L);

        QuizSubmitRequestDTO submitReq = new QuizSubmitRequestDTO();
        submitReq.setAttemptId(attemptId);
        submitReq.setQuestions(List.of(qSubmit));

        SqlCaptureInspector.start();
        quizTakingService.submitQuizAttempt(student.getId(), submitReq);
        List<String> sqls = SqlCaptureInspector.stop();
        
        Attempt attempt = attemptRepository.findById(attemptId).orElseThrow();
        assertThat(attempt.getEndedAt()).isNotNull();

        return sqls.stream()
                .map(this::normalizeSql)
                .collect(Collectors.groupingBy(s -> s, Collectors.counting()));
    }
}

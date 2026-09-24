package com.example.quizhub.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.quizhub.entity.Answer;
import com.example.quizhub.entity.Category;
import com.example.quizhub.entity.Practice;
import com.example.quizhub.entity.PracticeDetail;
import com.example.quizhub.entity.Question;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.QuestionStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.AnswerRepository;
import com.example.quizhub.repository.CategoryRepository;
import com.example.quizhub.repository.PracticeDetailRepository;
import com.example.quizhub.repository.PracticeRepository;
import com.example.quizhub.repository.QuestionRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.security.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Practice attempts are per-student. Every practice-lifecycle endpoint (start/resume, save-answer,
 * submit, history detail) used to load the {@code Practice} by id alone, so any authenticated
 * student who knew (or guessed) another student's practiceId could read, resume, overwrite answers
 * on, or grade-and-complete someone else's practice attempt. This class reproduces each defect
 * against the pre-fix code (RED) and re-verifies the same scenarios after the ownership check is
 * added (GREEN).
 */
@SpringBootTest(properties = "app.jwt.secret=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class PracticeOwnershipIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CategoryRepository categoryRepository;
    @Autowired
    private QuestionRepository questionRepository;
    @Autowired
    private AnswerRepository answerRepository;
    @Autowired
    private PracticeRepository practiceRepository;
    @Autowired
    private PracticeDetailRepository practiceDetailRepository;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private User studentA;
    private User studentB;
    private String tokenA;
    private String tokenB;

    private Category category;
    private Category otherCategory;
    private Question q1;
    private Question q2;
    private Question q3;
    private Answer q1Correct;
    private Answer q1Wrong;

    private Practice practiceB;
    private Practice practiceAOwnCategory;
    private Practice practiceAOtherCategory;

    @BeforeEach
    void seed() {
        practiceDetailRepository.deleteAll();
        practiceRepository.deleteAll();
        answerRepository.deleteAll();
        questionRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();

        studentA = user("practice_a@test.com");
        studentB = user("practice_b@test.com");
        tokenA = jwtService.generateToken(studentA);
        tokenB = jwtService.generateToken(studentB);

        category = categoryRepository.save(Category.builder().name("Cat Main").isPublic(true).build());
        otherCategory = categoryRepository.save(Category.builder().name("Cat Other").isPublic(true).build());

        q1 = question(category, "Q1?");
        q1Correct = answerRepository.save(Answer.builder().question(q1).text("Q1-correct").isCorrect(true).build());
        q1Wrong = answerRepository.save(Answer.builder().question(q1).text("Q1-wrong").isCorrect(false).build());
        q2 = question(category, "Q2?");
        answerRepository.save(Answer.builder().question(q2).text("Q2-correct").isCorrect(true).build());
        answerRepository.save(Answer.builder().question(q2).text("Q2-wrong").isCorrect(false).build());
        q3 = question(otherCategory, "Q3?");
        answerRepository.save(Answer.builder().question(q3).text("Q3-correct").isCorrect(true).build());

        // B's own sequential practice, with one question already answered correctly.
        practiceB = practiceRepository.save(Practice.builder()
                .user(studentB).category(category)
                .practiceLimit(2).practiceOffset(0).totalQuestions(2)
                .isRandom(false).isCompleted(false).correctAnswers(0)
                .build());
        practiceDetailRepository.save(PracticeDetail.builder()
                .practice(practiceB).question(q1)
                .selectedAnswers(List.of(q1Correct))
                .isCorrect(true)
                .build());

        // A's own practice under the SAME category (used for the happy-path / regression checks).
        practiceAOwnCategory = practiceRepository.save(Practice.builder()
                .user(studentA).category(category)
                .practiceLimit(2).practiceOffset(0).totalQuestions(2)
                .isRandom(false).isCompleted(false).correctAnswers(0)
                .build());

        // A's own practice under a DIFFERENT category (used for the category/practiceId mismatch check).
        practiceAOtherCategory = practiceRepository.save(Practice.builder()
                .user(studentA).category(otherCategory)
                .practiceLimit(1).practiceOffset(0).totalQuestions(1)
                .isRandom(false).isCompleted(false).correctAnswers(0)
                .build());
    }

    private User user(String email) {
        return userRepository.save(User.builder()
                .email(email).password("pw").fullName(email)
                .isEnable(true).isVerified(true).role(Role.STUDENT).build());
    }

    private Question question(Category cat, String text) {
        return questionRepository.save(Question.builder()
                .text(text).type(QuestionType.SINGLE_CHOICE).category(cat)
                .questionStatus(QuestionStatus.PUBLIC).build());
    }

    private MvcResult call(MockHttpServletRequestBuilder request, String token) throws Exception {
        MockHttpServletRequestBuilder req = request;
        if (token != null) {
            req = req.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(req).andReturn();
    }

    private String json(Object dto) throws Exception {
        return objectMapper.writeValueAsString(dto);
    }

    // Raw JDBC on purpose: PracticeDetail.selectedAnswers is a LAZY @ManyToMany, and reading it through
    // the JPA entity after the owning MockMvc call's transaction has closed throws LazyInitializationException.
    private List<Long> selectedAnswerIdsOf(Practice practice, Question question) {
        Long detailId = jdbcTemplate.queryForObject(
                "SELECT id FROM _practice_detail WHERE practice_id = ? AND question_id = ?",
                Long.class, practice.getId(), question.getId());
        return jdbcTemplate.queryForList(
                "SELECT answer_id FROM _practice_detail_selected_answers WHERE practice_detail_id = ?",
                Long.class, detailId);
    }

    private Boolean isCorrectOf(Practice practice, Question question) {
        return jdbcTemplate.queryForObject(
                "SELECT is_correct FROM _practice_detail WHERE practice_id = ? AND question_id = ?",
                Boolean.class, practice.getId(), question.getId());
    }

    // ---------- A. startPractice() resume branch ----------

    @Test
    void studentCannotResumeAnotherStudentsPracticeById() throws Exception {
        String body = json(new StartReq(category.getId(), 2, 0, false, false, practiceB.getId()));

        MvcResult result = call(post("/api/student/practice/start").contentType(MediaType.APPLICATION_JSON).content(body), tokenA);

        assertThat(result.getResponse().getStatus()).as("A must be rejected, not handed B's practice").isEqualTo(404);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1027");
        // B's practice must be completely untouched by A's attempt to resume it.
        Practice reloaded = practiceRepository.findById(practiceB.getId()).orElseThrow();
        assertThat(reloaded.getTotalQuestions()).isEqualTo(2);
        assertThat(reloaded.getIsCompleted()).isFalse();
    }

    @Test
    void ownerCanResumeTheirOwnPractice() throws Exception {
        String body = json(new StartReq(category.getId(), 2, 0, false, false, practiceB.getId()));

        MvcResult result = call(post("/api/student/practice/start").contentType(MediaType.APPLICATION_JSON).content(body), tokenB);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentAsString()).contains("\"practiceId\":" + practiceB.getId());
    }

    @Test
    void resumeRejectsPracticeIdWhoseCategoryDoesNotMatchTheRequest() throws Exception {
        // practiceAOtherCategory belongs to otherCategory, but the request claims `category`.
        String body = json(new StartReq(category.getId(), 1, 0, false, false, practiceAOtherCategory.getId()));

        MvcResult result = call(post("/api/student/practice/start").contentType(MediaType.APPLICATION_JSON).content(body), tokenA);

        assertThat(result.getResponse().getStatus()).as("categoryId/practiceId mismatch must not silently resume").isEqualTo(404);
    }

    // ---------- B(2). answer/question integrity within a practice ----------

    @Test
    void saveAnswerRejectsAnAnswerIdThatBelongsToADifferentQuestion() throws Exception {
        // q1Correct belongs to q1, not q2 - a client must not be able to mark q2 "correct" via q1's answer id.
        String body = json(new AnswerReq(q2.getId(), q1Correct.getId(), null, null));

        MvcResult result = call(post("/api/student/practice/save-answer")
                .queryParam("practiceId", String.valueOf(practiceAOwnCategory.getId()))
                .contentType(MediaType.APPLICATION_JSON).content(body), tokenA);

        assertThat(result.getResponse().getStatus()).as("answer must be validated against the question it was submitted for").isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1044");
    }

    @Test
    void submitRejectsAnAnswerIdThatBelongsToADifferentQuestion() throws Exception {
        String body = json(new SubmitReq(category.getId(), practiceAOwnCategory.getId(),
                List.of(new AnswerReq(q2.getId(), q1Correct.getId(), null, null))));

        MvcResult result = call(post("/api/student/practice/submit").contentType(MediaType.APPLICATION_JSON).content(body), tokenA);

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1044");
        Practice reloaded = practiceRepository.findById(practiceAOwnCategory.getId()).orElseThrow();
        assertThat(reloaded.getIsCompleted()).as("a malformed answer must not leave the practice half-graded").isFalse();
    }

    /**
     * submitPractice() is @Transactional and AppException extends RuntimeException, so Spring's default
     * rollback rule (rollback on unchecked exceptions) should undo the WHOLE method - including the
     * PracticeDetail row persisted for the first, valid answer in the payload - not just leave
     * isCompleted=false. This proves that end to end: two DB reads happen through fresh
     * repository calls in this un-@Transactional test class, so they hit Postgres for real, not a
     * stale Hibernate persistence-context cache from inside the (already-finished, rolled-back) request.
     */
    @Test
    void submitRollsBackEarlierValidAnswersWhenALaterAnswerFailsValidation() throws Exception {
        String body = json(new SubmitReq(category.getId(), practiceAOwnCategory.getId(),
                List.of(
                        new AnswerReq(q1.getId(), q1Correct.getId(), null, null), // valid
                        new AnswerReq(q2.getId(), q1Correct.getId(), null, null)  // invalid: q1's answer against q2
                )));

        MvcResult result = call(post("/api/student/practice/submit").contentType(MediaType.APPLICATION_JSON).content(body), tokenA);

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1044");

        // Fresh reads via JdbcTemplate: bypasses any Hibernate session/persistence-context entirely,
        // so this can only see what Postgres actually committed - not an in-memory view of the request.
        Integer practiceDetailRows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM _practice_detail WHERE practice_id = ?",
                Integer.class, practiceAOwnCategory.getId());
        assertThat(practiceDetailRows)
                .as("the first (valid) answer's PracticeDetail must be rolled back with the rest of the transaction, "
                        + "not left half-persisted")
                .isEqualTo(0);

        Practice reloaded = practiceRepository.findById(practiceAOwnCategory.getId()).orElseThrow();
        assertThat(reloaded.getIsCompleted()).isFalse();
        assertThat(reloaded.getCorrectAnswers()).isEqualTo(0);
    }

    // ---------- B. saveAnswer() ----------

    @Test
    void studentCannotSaveAnswerIntoAnotherStudentsPractice() throws Exception {
        String body = json(new AnswerReq(q1.getId(), q1Wrong.getId(), null, null));

        MvcResult result = call(post("/api/student/practice/save-answer")
                .queryParam("practiceId", String.valueOf(practiceB.getId()))
                .contentType(MediaType.APPLICATION_JSON).content(body), tokenA);

        assertThat(result.getResponse().getStatus()).isEqualTo(404);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1027");

        assertThat(selectedAnswerIdsOf(practiceB, q1)).containsExactly(q1Correct.getId());
        assertThat(isCorrectOf(practiceB, q1)).as("B's saved answer must not be overwritten by A").isTrue();
    }

    @Test
    void ownerCanSaveAnswerIntoTheirOwnPractice() throws Exception {
        String body = json(new AnswerReq(q1.getId(), q1Wrong.getId(), null, null));

        MvcResult result = call(post("/api/student/practice/save-answer")
                .queryParam("practiceId", String.valueOf(practiceB.getId()))
                .contentType(MediaType.APPLICATION_JSON).content(body), tokenB);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(selectedAnswerIdsOf(practiceB, q1)).containsExactly(q1Wrong.getId());
        assertThat(isCorrectOf(practiceB, q1)).isFalse();
    }

    @Test
    void saveAnswerOnNonExistentPracticeIsIndistinguishableFromForeign() throws Exception {
        String body = json(new AnswerReq(q1.getId(), q1Wrong.getId(), null, null));

        MvcResult foreign = call(post("/api/student/practice/save-answer")
                .queryParam("practiceId", String.valueOf(practiceB.getId()))
                .contentType(MediaType.APPLICATION_JSON).content(body), tokenA);
        MvcResult missing = call(post("/api/student/practice/save-answer")
                .queryParam("practiceId", "999999999")
                .contentType(MediaType.APPLICATION_JSON).content(body), tokenA);

        assertThat(foreign.getResponse().getStatus()).isEqualTo(missing.getResponse().getStatus());
        String foreignBody = foreign.getResponse().getContentAsString().replaceAll("\"timestamp\":\"[^\"]*\"", "");
        String missingBody = missing.getResponse().getContentAsString().replaceAll("\"timestamp\":\"[^\"]*\"", "");
        assertThat(foreignBody).isEqualTo(missingBody);
    }

    // ---------- C. submitPractice() ----------

    @Test
    void studentCannotSubmitAnotherStudentsPractice() throws Exception {
        String body = json(new SubmitReq(category.getId(), practiceB.getId(),
                List.of(new AnswerReq(q1.getId(), q1Wrong.getId(), null, null))));

        MvcResult result = call(post("/api/student/practice/submit").contentType(MediaType.APPLICATION_JSON).content(body), tokenA);

        assertThat(result.getResponse().getStatus()).isEqualTo(404);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1027");

        Practice reloaded = practiceRepository.findById(practiceB.getId()).orElseThrow();
        assertThat(reloaded.getIsCompleted()).as("B's practice must not be completed by A's submit").isFalse();
        assertThat(reloaded.getCorrectAnswers()).isEqualTo(0);
        assertThat(selectedAnswerIdsOf(practiceB, q1)).containsExactly(q1Correct.getId());
    }

    @Test
    void ownerCanSubmitTheirOwnPractice() throws Exception {
        String body = json(new SubmitReq(category.getId(), practiceAOwnCategory.getId(),
                List.of(new AnswerReq(q1.getId(), q1Correct.getId(), null, null))));

        MvcResult result = call(post("/api/student/practice/submit").contentType(MediaType.APPLICATION_JSON).content(body), tokenA);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        Practice reloaded = practiceRepository.findById(practiceAOwnCategory.getId()).orElseThrow();
        assertThat(reloaded.getIsCompleted()).isTrue();
        assertThat(reloaded.getCorrectAnswers()).isEqualTo(1);
    }

    // ---------- D. getPracticeDetail() ----------

    @Test
    void studentCannotReadAnotherStudentsPracticeDetail() throws Exception {
        MvcResult result = call(get("/api/student/practice/history/detail").queryParam("id", String.valueOf(practiceB.getId())), tokenA);

        assertThat(result.getResponse().getStatus())
                .as("must not be 401 (that logs the caller out client-side); must be a plain not-found")
                .isEqualTo(404);
        assertThat(result.getResponse().getContentAsString())
                .contains("\"code\":1027")
                .doesNotContain("practice_b@test.com");
    }

    @Test
    void ownerCanReadTheirOwnPracticeDetail() throws Exception {
        MvcResult result = call(get("/api/student/practice/history/detail").queryParam("id", String.valueOf(practiceB.getId())), tokenB);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentAsString()).contains("\"practiceId\":" + practiceB.getId());
    }

    @Test
    void foreignAndNonExistentPracticeDetailAreIndistinguishable() throws Exception {
        MvcResult foreign = call(get("/api/student/practice/history/detail").queryParam("id", String.valueOf(practiceB.getId())), tokenA);
        MvcResult missing = call(get("/api/student/practice/history/detail").queryParam("id", "999999999"), tokenA);

        assertThat(foreign.getResponse().getStatus()).isEqualTo(missing.getResponse().getStatus());
        String foreignBody = foreign.getResponse().getContentAsString().replaceAll("\"timestamp\":\"[^\"]*\"", "");
        String missingBody = missing.getResponse().getContentAsString().replaceAll("\"timestamp\":\"[^\"]*\"", "");
        assertThat(foreignBody).isEqualTo(missingBody);
    }

    // ---------- Existing rule preserved: saving after completion is rejected ----------

    @Test
    void ownerCannotSaveAnswerAfterOwnPracticeIsCompleted() throws Exception {
        practiceAOwnCategory.setIsCompleted(true);
        practiceRepository.save(practiceAOwnCategory);

        String body = json(new AnswerReq(q1.getId(), q1Correct.getId(), null, null));
        MvcResult result = call(post("/api/student/practice/save-answer")
                .queryParam("practiceId", String.valueOf(practiceAOwnCategory.getId()))
                .contentType(MediaType.APPLICATION_JSON).content(body), tokenA);

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1033");
    }

    // ---------- Authentication boundary ----------

    @Test
    void unauthenticatedRequestsAreRejectedWith401() throws Exception {
        MvcResult result = call(get("/api/student/practice/history/detail").queryParam("id", String.valueOf(practiceB.getId())), null);

        assertThat(result.getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void authenticatedButUnauthorizedRequestsAreNeverReportedAs401() throws Exception {
        MvcResult result = call(get("/api/student/practice/history/detail").queryParam("id", String.valueOf(practiceB.getId())), tokenA);

        assertThat(result.getResponse().getStatus())
                .as("A IS authenticated; being denied someone else's resource must not look like a dead session")
                .isNotEqualTo(401);
    }

    // ---- small local DTO mirrors (avoids depending on Lombok @Builder wiring for JSON bodies) ----

    static class StartReq {
        public Long categoryId;
        public Integer limit;
        public Integer offset;
        public Boolean isRandom;
        public Boolean forceNew;
        public Long practiceId;

        StartReq(Long categoryId, Integer limit, Integer offset, Boolean isRandom, Boolean forceNew, Long practiceId) {
            this.categoryId = categoryId;
            this.limit = limit;
            this.offset = offset;
            this.isRandom = isRandom;
            this.forceNew = forceNew;
            this.practiceId = practiceId;
        }
    }

    static class AnswerReq {
        public Long questionId;
        public Long selectedAnswerId;
        public List<Long> selectedAnswerIds;
        public String selectedText;

        AnswerReq(Long questionId, Long selectedAnswerId, List<Long> selectedAnswerIds, String selectedText) {
            this.questionId = questionId;
            this.selectedAnswerId = selectedAnswerId;
            this.selectedAnswerIds = selectedAnswerIds;
            this.selectedText = selectedText;
        }
    }

    static class SubmitReq {
        public Long categoryId;
        public Long practiceId;
        public List<AnswerReq> answers;

        SubmitReq(Long categoryId, Long practiceId, List<AnswerReq> answers) {
            this.categoryId = categoryId;
            this.practiceId = practiceId;
            this.answers = answers;
        }
    }
}

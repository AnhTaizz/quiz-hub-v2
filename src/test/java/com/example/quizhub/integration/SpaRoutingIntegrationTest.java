package com.example.quizhub.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.security.JwtService;

/**
 * Proves the React SPA route-ownership map: React-owned routes forward to the
 * SPA shell, while legacy Thymeleaf pages (admin, profile, unmigrated student
 * pages), the JSON API and actuator are never captured by it, and the
 * existing role enforcement on /student/** is unchanged.
 */
// JwtService base64-decodes its secret; the shared test profile's placeholder is not valid
// base64 (no other test signs a JWT), so this test supplies its own throwaway key.
@SpringBootTest(properties = "app.jwt.secret=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class SpaRoutingIntegrationTest {

    private static final String SPA_INDEX = "/app/index.html";

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private JwtService jwtService;

    private String studentToken;
    private String teacherToken;
    private String adminToken;

    @BeforeEach
    void createUsers() {
        studentToken = tokenFor("spa_student@test.com", Role.STUDENT);
        teacherToken = tokenFor("spa_teacher@test.com", Role.TEACHER);
        adminToken = tokenFor("spa_admin@test.com", Role.ADMIN);
    }

    private String tokenFor(String email, Role role) {
        User user = userRepository.findByEmail(email).orElseGet(() -> userRepository.save(User.builder()
                .email(email).password("pw").fullName(role.name())
                .isEnable(true).isVerified(true).role(role).build()));
        return jwtService.generateToken(user);
    }

    @ParameterizedTest
    @ValueSource(strings = { "/", "/login", "/register", "/forgot-password", "/oauth2-redirect.html" })
    void publicReactRoutesForwardToSpaShellAnonymously(String path) throws Exception {
        mockMvc.perform(get(path)).andExpect(status().isOk()).andExpect(forwardedUrl(SPA_INDEX));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/student", "/student/quizzes", "/student/classrooms", "/student/classrooms/42",
            "/student/history", "/student/quiz/play/5", "/student/quiz/resume/9", "/student/quiz/result/9" })
    void studentReactRoutesForwardToSpaShellForStudents(String path) throws Exception {
        mockMvc.perform(get(path).header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl(SPA_INDEX));
    }

    @Test
    void studentRoutesStillRequireAuthenticationAndPreserveReturnUrl() throws Exception {
        mockMvc.perform(get("/student"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/login?returnUrl=%2Fstudent"));
    }

    @Test
    void teacherCannotReachStudentSpaRoutes() throws Exception {
        MvcResult result = mockMvc.perform(get("/student").header("Authorization", "Bearer " + teacherToken))
                .andReturn();
        assertThat(result.getResponse().getForwardedUrl()).isNull();
        assertThat(result.getResponse().getStatus()).isNotEqualTo(200);
    }

    @Test
    void legacyAdminPagesAreNotCapturedBySpa() throws Exception {
        MvcResult result = mockMvc.perform(get("/admin/users").header("Authorization", "Bearer " + adminToken))
                .andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getForwardedUrl()).isNull();
        assertThat(result.getModelAndView()).isNotNull();
        assertThat(result.getModelAndView().getViewName()).isEqualTo("admin/admin-users");
    }

    @Test
    void legacyAdminHomeIsNotCapturedBySpa() throws Exception {
        MvcResult result = mockMvc.perform(get("/admin").header("Authorization", "Bearer " + adminToken)).andReturn();
        assertThat(result.getResponse().getForwardedUrl()).isNull();
        assertThat(result.getModelAndView()).isNotNull();
        assertThat(result.getModelAndView().getViewName()).isEqualTo("admin/admin-home");
    }

    @Test
    void legacyProfilePageIsNotCapturedBySpa() throws Exception {
        MvcResult result = mockMvc.perform(get("/profile").header("Authorization", "Bearer " + studentToken))
                .andReturn();
        assertThat(result.getResponse().getForwardedUrl()).isNull();
        assertThat(result.getModelAndView()).isNotNull();
        assertThat(result.getModelAndView().getViewName()).isEqualTo("profile");
    }

    @Test
    void unmigratedStudentPagesRemainOnThymeleaf() throws Exception {
        MvcResult result = mockMvc.perform(get("/student/quiz/create").header("Authorization", "Bearer " + studentToken))
                .andReturn();
        assertThat(result.getResponse().getForwardedUrl()).isNull();
        assertThat(result.getModelAndView()).isNotNull();
        assertThat(result.getModelAndView().getViewName()).startsWith("student/");
    }

    @Test
    void nonNumericIdsAreNotForwardedToSpa() throws Exception {
        MvcResult result = mockMvc.perform(get("/student/classrooms/abc").header("Authorization", "Bearer " + studentToken))
                .andReturn();
        assertThat(result.getResponse().getForwardedUrl()).isNull();
    }

    @Test
    void apiIsNeverForwardedToSpaAndStillRequiresAuthentication() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/student/dashboard")).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(401);
        assertThat(result.getResponse().getForwardedUrl()).isNull();
    }

    @Test
    void newJsonEndpointsRejectNonStudents() throws Exception {
        for (String path : new String[] { "/api/student/dashboard", "/api/student/quiz/assigned",
                "/api/student/quiz/history", "/api/student/classrooms" }) {
            MvcResult result = mockMvc.perform(get(path).header("Authorization", "Bearer " + teacherToken)).andReturn();
            // Denied by @PreAuthorize (method security); GlobalExceptionHandle maps that to 403.
            assertThat(result.getResponse().getStatus()).as(path).isEqualTo(403);
            assertThat(result.getResponse().getContentAsString()).as(path).doesNotContain("assignedQuizzes");
        }
    }

    @Test
    void studentCanCallNewJsonEndpoints() throws Exception {
        for (String path : new String[] { "/api/student/dashboard", "/api/student/quiz/assigned",
                "/api/student/quiz/history", "/api/student/classrooms" }) {
            MvcResult result = mockMvc.perform(get(path).header("Authorization", "Bearer " + studentToken)).andReturn();
            assertThat(result.getResponse().getStatus()).as(path).isEqualTo(200);
            assertThat(result.getResponse().getContentType()).as(path).contains("application/json");
        }
    }

    @Test
    void actuatorHealthIsNotForwardedToSpa() throws Exception {
        MvcResult result = mockMvc.perform(get("/actuator/health")).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getForwardedUrl()).isNull();
    }
}

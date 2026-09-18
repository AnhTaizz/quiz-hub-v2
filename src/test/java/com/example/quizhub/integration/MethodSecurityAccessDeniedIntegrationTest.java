package com.example.quizhub.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
 * A wrong-role caller rejected by a controller's @PreAuthorize (method security) must get 403, not 500.
 *
 * /api/student/** is deliberately open to ADMIN/TEACHER/STUDENT at the SecurityFilterChain, while
 * StudentDashboardRestController is @PreAuthorize("hasRole('STUDENT')"). So an authenticated TEACHER
 * passes the filter chain and is denied only by method security, which throws AccessDeniedException from
 * inside the controller layer - the path this test pins down. The filter-chain denial
 * (CustomAccessDeniedHandler) is asserted separately as a control.
 */
@SpringBootTest(properties = "app.jwt.secret=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class MethodSecurityAccessDeniedIntegrationTest {

    /** Reached by TEACHER through the filter chain, denied only by @PreAuthorize(STUDENT). */
    private static final String METHOD_SECURED_STUDENT_API = "/api/student/dashboard";
    /** Denied for STUDENT by the SecurityFilterChain itself ("/api/teacher/**" -> ADMIN/TEACHER). */
    private static final String FILTER_CHAIN_TEACHER_API = "/api/teacher/classrooms";

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

    @BeforeEach
    void createUsers() {
        studentToken = tokenFor("msad_student@test.com", Role.STUDENT);
        teacherToken = tokenFor("msad_teacher@test.com", Role.TEACHER);
    }

    private String tokenFor(String email, Role role) {
        User user = userRepository.findByEmail(email).orElseGet(() -> userRepository.save(User.builder()
                .email(email).password("pw").fullName(role.name())
                .isEnable(true).isVerified(true).role(role).build()));
        return jwtService.generateToken(user);
    }

    private MvcResult call(String path, String token) throws Exception {
        var request = get(path);
        if (token != null) {
            request = request.header("Authorization", "Bearer " + token);
        }
        return mockMvc.perform(request).andReturn();
    }

    @Test
    void unauthenticatedRequestIsStill401() throws Exception {
        MvcResult result = call(METHOD_SECURED_STUDENT_API, null);

        assertThat(result.getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void wrongRoleDeniedByMethodSecurityIs403NotAServerError() throws Exception {
        MvcResult result = call(METHOD_SECURED_STUDENT_API, teacherToken);

        assertThat(result.getResponse().getStatus()).as("TEACHER on a @PreAuthorize(STUDENT) endpoint").isEqualTo(403);
        assertThat(result.getResponse().getContentType()).contains("application/json");
    }

    @Test
    void methodSecurityDenialUsesTheStandardErrorShapeWithoutLeakingInternals() throws Exception {
        MvcResult result = call(METHOD_SECURED_STUDENT_API, teacherToken);
        String body = result.getResponse().getContentAsString();

        assertThat(result.getResponse().getStatus()).isEqualTo(403);
        assertThat(body).contains("\"status\":403").contains("\"code\":1045").contains("\"message\"").contains("\"timestamp\"");
        // No stack traces, class names, authorization expressions or token details.
        assertThat(body).doesNotContain("Exception").doesNotContain("hasRole").doesNotContain("PreAuthorize")
                .doesNotContain("org.springframework").doesNotContain("com.example").doesNotContain(teacherToken);
    }

    @Test
    void correctRoleStillReachesTheEndpoint() throws Exception {
        MvcResult result = call(METHOD_SECURED_STUDENT_API, studentToken);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentType()).contains("application/json");
        assertThat(result.getResponse().getContentAsString()).contains("\"greeting\"");
    }

    @Test
    void filterChainDenialIsUnchangedAnd403() throws Exception {
        MvcResult result = call(FILTER_CHAIN_TEACHER_API, studentToken);

        assertThat(result.getResponse().getStatus()).as("STUDENT on a /api/teacher/** endpoint").isEqualTo(403);
    }

    @Test
    void filterChainAllowsTheWrongRoleThroughSoTheDenialReallyComesFromMethodSecurity() throws Exception {
        // Guards the premise of this suite: the TEACHER is NOT stopped by the filter chain on /api/student/**.
        // A path-level denial would use CustomAccessDeniedHandler, whose body is exactly
        // {"status":403,"message":...} with no "code"; the method-security path uses the ErrorResponse shape.
        MvcResult result = call(METHOD_SECURED_STUDENT_API, teacherToken);

        assertThat(result.getResponse().getContentAsString()).contains("\"code\"");
    }
}

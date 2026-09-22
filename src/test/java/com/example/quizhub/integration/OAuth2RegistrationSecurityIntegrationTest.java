package com.example.quizhub.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.UserRepository;

/**
 * POST /api/auth/oauth2-register is public and, before this fix, took email/fullName/avatarUrl/role
 * entirely from the request body: anyone with curl could create a fully-verified ("isVerified":true)
 * account for an email address they do not own and receive a signed JWT for it, without ever touching
 * Google OAuth2. This class proves that end to end against the pre-fix code (RED) and re-verifies the
 * fixed invariants afterward (GREEN). No real Google account or credentials are used anywhere here.
 */
@SpringBootTest(properties = "app.jwt.secret=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class OAuth2RegistrationSecurityIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void seed() {
        userRepository.deleteAll();
    }

    private User user(String email, boolean enabled) {
        return userRepository.save(User.builder()
                .email(email).password(passwordEncoder.encode("x")).fullName("Existing User")
                .role(Role.STUDENT).isEnable(enabled).isVerified(true).build());
    }

    // ---------- RED: the core trust-boundary defect ----------

    @Test
    void cannotRegisterWithoutPriorGoogleCallback() throws Exception {
        String body = """
                {"email":"attacker@evil.test","fullName":"Attacker","avatarUrl":"","role":"STUDENT"}
                """;

        MvcResult result = mockMvc.perform(post("/api/auth/oauth2-register")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();

        assertThat(result.getResponse().getStatus())
                .as("must require proof of a real prior Google callback, not just an email in the request body")
                .isGreaterThanOrEqualTo(400);
        assertThat(userRepository.findByEmail("attacker@evil.test"))
                .as("no account may be created for an email the caller never proved ownership of")
                .isEmpty();
        assertThat(result.getResponse().getContentAsString())
                .as("no JWT may be issued when no account was created")
                .doesNotContain("\"token\"");
    }

    @Test
    void invalidRoleIsRejectedExplicitly() throws Exception {
        String body = """
                {"email":"weird-role@test.com","fullName":"X","avatarUrl":"","role":"SUPERADMIN"}
                """;

        MvcResult result = mockMvc.perform(post("/api/auth/oauth2-register")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();

        assertThat(result.getResponse().getStatus())
                .as("an unrecognized role must be rejected outright, not silently downgraded to STUDENT")
                .isEqualTo(400);
        assertThat(userRepository.findByEmail("weird-role@test.com")).isEmpty();
    }

    // ---------- Regression: invariants that were ALREADY correct before this fix ----------

    @Test
    void existingAccountEmailIsRejected() throws Exception {
        user("existing@test.com", true);

        String body = """
                {"email":"existing@test.com","fullName":"Someone Else","avatarUrl":"","role":"STUDENT"}
                """;
        MvcResult result = mockMvc.perform(post("/api/auth/oauth2-register")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1013");
        assertThat(userRepository.count()).as("no duplicate account").isEqualTo(1);
    }

    @Test
    void lockedAccountEmailCannotBeReRegisteredForAFreshJwt() throws Exception {
        user("locked@test.com", false);

        String body = """
                {"email":"locked@test.com","fullName":"Locked User","avatarUrl":"","role":"STUDENT"}
                """;
        MvcResult result = mockMvc.perform(post("/api/auth/oauth2-register")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString())
                .as("a locked account's email must never yield a fresh JWT via re-registration")
                .doesNotContain("\"token\"");
    }
}

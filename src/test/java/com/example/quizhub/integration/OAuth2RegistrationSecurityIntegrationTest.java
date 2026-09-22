package com.example.quizhub.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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

import com.example.quizhub.dto.auth.request.OAuth2RegisterRequest;
import com.example.quizhub.dto.auth.response.AuthResponse;
import com.example.quizhub.entity.OAuth2RegistrationTicket;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.OAuth2RegistrationTicketRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.security.OAuth2RegistrationTicketCookie;
import com.example.quizhub.service.AuthService;

import jakarta.servlet.http.Cookie;

/**
 * POST /api/auth/oauth2-register is public and, before this fix, took email/fullName/avatarUrl/role
 * entirely from the request body: anyone with curl could create a fully-verified ("isVerified":true)
 * account for an email address they do not own and receive a signed JWT for it, without ever touching
 * Google OAuth2. This class proves that end to end against the pre-fix code (RED) and re-verifies the
 * fixed invariants afterward (GREEN). No real Google account or credentials are used anywhere here.
 *
 * The tests in the first two sections (RED, and the two "already correct" regression tests) run
 * unmodified against both the pre-fix and post-fix code - see the RED evidence in this class's git
 * history for the failing run. Everything from "new invariants" onward exercises the ticket mechanism
 * this fix introduces and only makes sense against the post-fix code.
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
    @Autowired
    private OAuth2RegistrationTicketRepository ticketRepository;
    @Autowired
    private AuthService authService;

    @BeforeEach
    void seed() {
        userRepository.deleteAll();
        ticketRepository.deleteAll();
    }

    private User user(String email, boolean enabled) {
        return userRepository.save(User.builder()
                .email(email).password(passwordEncoder.encode("x")).fullName("Existing User")
                .role(Role.STUDENT).isEnable(enabled).isVerified(true).build());
    }

    /** Simulates "a real Google callback already happened for this email" without touching Google. */
    private String ticket(String email, Duration ttlFromNow) {
        String token = OAuth2RegistrationTicketCookie.generateToken();
        ticketRepository.save(OAuth2RegistrationTicket.builder()
                .token(token).email(email).fullName("Google User").avatarUrl(null)
                .expiresAt(LocalDateTime.now().plus(ttlFromNow))
                .build());
        return token;
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
    //
    // These two originally sent the existing/locked email in the request body with no ticket at all
    // (see this class's RED-evidence commit) and passed even against the pre-fix code, because
    // AuthServiceImpl already called existsByEmail() before creating a user. Now that identity comes
    // from a ticket instead of the body, they are rewritten to seed a real ticket for that email -
    // simulating "the real Google account tied to this email somehow already exists as a User row" -
    // so they keep exercising the existsByEmail() check, now reached via the ticket path.

    @Test
    void existingAccountEmailIsRejected() throws Exception {
        user("existing@test.com", true);
        String token = ticket("existing@test.com", OAuth2RegistrationTicketCookie.TTL);

        String body = """
                {"role":"STUDENT"}
                """;
        MvcResult result = mockMvc.perform(post("/api/auth/oauth2-register")
                .cookie(new Cookie(OAuth2RegistrationTicketCookie.COOKIE_NAME, token))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1013");
        assertThat(userRepository.count()).as("no duplicate account").isEqualTo(1);
    }

    @Test
    void lockedAccountEmailCannotBeReRegisteredForAFreshJwt() throws Exception {
        user("locked@test.com", false);
        String token = ticket("locked@test.com", OAuth2RegistrationTicketCookie.TTL);

        String body = """
                {"role":"STUDENT"}
                """;
        MvcResult result = mockMvc.perform(post("/api/auth/oauth2-register")
                .cookie(new Cookie(OAuth2RegistrationTicketCookie.COOKIE_NAME, token))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString())
                .as("a locked account's email must never yield a fresh JWT via re-registration")
                .doesNotContain("\"token\"");
    }

    // ---------- New invariants introduced by this fix (post-fix only; no RED counterpart) ----------

    @Test
    void clientSuppliedIdentityFieldsAreIgnoredInFavorOfTheTicket() throws Exception {
        String token = ticket("real.google.user@gmail.com", OAuth2RegistrationTicketCookie.TTL);
        // Old-shape body, still sent by nothing in production anymore, but proves the server no longer
        // even looks at these fields: a tampered email here must have zero effect on the created account.
        String body = """
                {"email":"attacker-controlled@evil.test","fullName":"Not Google","avatarUrl":"","role":"STUDENT"}
                """;

        MvcResult result = mockMvc.perform(post("/api/auth/oauth2-register")
                .cookie(new Cookie(OAuth2RegistrationTicketCookie.COOKIE_NAME, token))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(userRepository.findByEmail("real.google.user@gmail.com"))
                .as("the account must be created for the ticket's (real) email")
                .isPresent();
        assertThat(userRepository.findByEmail("attacker-controlled@evil.test"))
                .as("the request body's email must never be used, tampered or not")
                .isEmpty();
    }

    @Test
    void ticketCannotBeReplayedAfterSuccessfulCompletion() throws Exception {
        String token = ticket("replay-me@gmail.com", OAuth2RegistrationTicketCookie.TTL);
        String body = """
                {"role":"STUDENT"}
                """;
        Cookie cookie = new Cookie(OAuth2RegistrationTicketCookie.COOKIE_NAME, token);

        MvcResult first = mockMvc.perform(post("/api/auth/oauth2-register")
                .cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
        assertThat(first.getResponse().getStatus()).isEqualTo(200);

        MvcResult replay = mockMvc.perform(post("/api/auth/oauth2-register")
                .cookie(cookie).contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();

        assertThat(replay.getResponse().getStatus())
                .as("a consumed ticket must not be usable a second time")
                .isEqualTo(400);
        assertThat(replay.getResponse().getContentAsString()).contains("\"code\":1047");
        assertThat(userRepository.count()).as("still exactly one account, not two").isEqualTo(1);
    }

    @Test
    void expiredTicketIsRejected() throws Exception {
        String token = ticket("too-late@gmail.com", Duration.ofMinutes(-1)); // already expired
        String body = """
                {"role":"STUDENT"}
                """;

        MvcResult result = mockMvc.perform(post("/api/auth/oauth2-register")
                .cookie(new Cookie(OAuth2RegistrationTicketCookie.COOKIE_NAME, token))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1047");
        assertThat(userRepository.findByEmail("too-late@gmail.com")).isEmpty();
    }

    /**
     * Two requests race to complete the SAME ticket (e.g. a double form submit, or two browser tabs).
     * OAuth2RegistrationTicketRepository#consumeIfValid takes a Postgres row lock on UPDATE, so exactly
     * one of the two concurrent calls can ever see itself as the winner; the loser must fail cleanly,
     * not create a second account or issue a second JWT for a role neither request actually "won".
     */
    @Test
    void concurrentCompletionsOfTheSameTicketCreateExactlyOneAccount() throws Exception {
        String token = ticket("racing@gmail.com", OAuth2RegistrationTicketCookie.TTL);

        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(2);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        Callable<AuthResponse> task = () -> {
            try {
                startLatch.await();
                return authService.registerOAuth2(token, OAuth2RegisterRequest.builder().role("STUDENT").build());
            } finally {
                doneLatch.countDown();
            }
        };

        Future<AuthResponse> future1 = executor.submit(task);
        Future<AuthResponse> future2 = executor.submit(task);
        startLatch.countDown();
        assertThat(doneLatch.await(15, TimeUnit.SECONDS)).isTrue();
        executor.shutdown();

        int succeeded = 0;
        int rejected = 0;
        for (Future<AuthResponse> future : List.of(future1, future2)) {
            try {
                future.get();
                succeeded++;
            } catch (Exception e) {
                rejected++;
            }
        }

        assertThat(succeeded).as("exactly one of the two concurrent completions wins").isEqualTo(1);
        assertThat(rejected).isEqualTo(1);
        assertThat(userRepository.count()).as("exactly one account, no duplicate role/identity confusion").isEqualTo(1);
    }

    // ---------- GET /api/auth/oauth2-register/pending (display-only preview) ----------

    @Test
    void pendingRegistrationPreviewReflectsTheTicket() throws Exception {
        String token = ticket("preview@gmail.com", OAuth2RegistrationTicketCookie.TTL);

        MvcResult result = mockMvc.perform(get("/api/auth/oauth2-register/pending")
                .cookie(new Cookie(OAuth2RegistrationTicketCookie.COOKIE_NAME, token))).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getContentAsString()).contains("preview@gmail.com");
    }

    @Test
    void pendingRegistrationRejectsAMissingTicket() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/oauth2-register/pending")).andReturn();

        assertThat(result.getResponse().getStatus())
                .as("a browser that lands on the choose-role page with no/expired ticket must get a clean, "
                        + "recognizable rejection so it can restart the sign-in flow")
                .isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1047");
    }

    @Test
    void pendingRegistrationRejectsAnExpiredTicket() throws Exception {
        String token = ticket("expired-preview@gmail.com", Duration.ofMinutes(-1));

        MvcResult result = mockMvc.perform(get("/api/auth/oauth2-register/pending")
                .cookie(new Cookie(OAuth2RegistrationTicketCookie.COOKIE_NAME, token))).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
    }
}

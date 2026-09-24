package com.example.quizhub.integration;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.quizhub.dto.auth.response.AuthResponse;
import com.example.quizhub.entity.OAuth2LoginTicket;
import com.example.quizhub.entity.OAuth2RegistrationTicket;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.OAuth2LoginTicketRepository;
import com.example.quizhub.repository.OAuth2RegistrationTicketRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.security.OAuth2LoginTicketCookie;
import com.example.quizhub.security.OAuth2RegistrationTicketCookie;
import com.example.quizhub.service.AuthService;

import jakarta.servlet.http.Cookie;

/**
 * POST /api/auth/oauth2-login is public and, before this fix, was not needed at all:
 * OAuth2AuthenticationSuccessHandler put a real JWT plus id/email/fullName/role/avatarUrl directly into
 * the /oauth2-redirect.html query string of its server-side redirect for an existing user's Google login.
 * This class proves the replacement mechanism - a single-use, 90-second OAuth2LoginTicket bound to an
 * HttpOnly cookie, exchanged here for the JWT in a JSON body only - meets the same invariants the
 * registration ticket already does, and that the two ticket types are not interchangeable. No real
 * Google account or credentials are used anywhere here; a ticket is seeded directly, simulating "a real
 * Google callback for this user id already happened" the same way OAuth2RegistrationSecurityIntegrationTest
 * simulates the registration case.
 */
@SpringBootTest(properties = "app.jwt.secret=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class OAuth2ExistingLoginSecurityIntegrationTest {

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
    private OAuth2LoginTicketRepository loginTicketRepository;
    @Autowired
    private OAuth2RegistrationTicketRepository registrationTicketRepository;
    @Autowired
    private AuthService authService;

    @BeforeEach
    void seed() {
        loginTicketRepository.deleteAll();
        registrationTicketRepository.deleteAll();
        userRepository.deleteAll();
    }

    private User user(String email, boolean enabled) {
        return userRepository.save(User.builder()
                .email(email).password(passwordEncoder.encode("x")).fullName("Existing User")
                .role(Role.STUDENT).isEnable(enabled).isVerified(true).build());
    }

    /** Simulates "a real Google callback for this existing user id already happened" without touching Google. */
    private String loginTicket(Long userId, Duration ttlFromNow) {
        String token = OAuth2LoginTicketCookie.generateToken();
        loginTicketRepository.save(OAuth2LoginTicket.builder()
                .token(token).userId(userId)
                .expiresAt(LocalDateTime.now().plus(ttlFromNow))
                .build());
        return token;
    }

    private MvcResult exchange(String token) throws Exception {
        var builder = post("/api/auth/oauth2-login");
        if (token != null) {
            builder.cookie(new Cookie(OAuth2LoginTicketCookie.COOKIE_NAME, token));
        }
        return mockMvc.perform(builder).andReturn();
    }

    // ---------- Core happy path ----------

    @Test
    void existingEnabledUserExchangesTheTicketForAFreshJwt() throws Exception {
        User user = user("real.google.user@gmail.com", true);
        String token = loginTicket(user.getId(), OAuth2LoginTicketCookie.TTL);

        MvcResult result = exchange(token);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("\"token\"").contains("real.google.user@gmail.com");
        assertThat(result.getResponse().getHeader("Cache-Control"))
                .as("the JWT-bearing body must never be written to a shared/browser cache")
                .contains("no-store");
        // The response can legitimately carry more than one Set-Cookie header (e.g. the app's own
        // XSRF-TOKEN cookie, set earlier in the filter chain) - getHeader() would only ever see the
        // first one and silently miss this one, so this must check the full list.
        assertThat(result.getResponse().getHeaders("Set-Cookie"))
                .as("the consumed ticket cookie is cleared on success")
                .anySatisfy(header -> assertThat(header).contains(OAuth2LoginTicketCookie.COOKIE_NAME + "="));
    }

    // ---------- No ticket, fake ticket, expired, replay ----------

    @Test
    void missingTicketIsRejected() throws Exception {
        MvcResult result = exchange(null);

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1049");
    }

    @Test
    void fakeTicketIsRejected() throws Exception {
        MvcResult result = exchange("this-token-was-never-issued-by-the-server");

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1049");
    }

    @Test
    void expiredTicketIsRejected() throws Exception {
        User user = user("too-late@gmail.com", true);
        String token = loginTicket(user.getId(), Duration.ofSeconds(-1)); // already expired

        MvcResult result = exchange(token);

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1049");
    }

    @Test
    void ticketCannotBeReplayedAfterSuccessfulExchange() throws Exception {
        User user = user("replay-me@gmail.com", true);
        String token = loginTicket(user.getId(), OAuth2LoginTicketCookie.TTL);
        Cookie cookie = new Cookie(OAuth2LoginTicketCookie.COOKIE_NAME, token);

        MvcResult first = mockMvc.perform(post("/api/auth/oauth2-login").cookie(cookie)).andReturn();
        assertThat(first.getResponse().getStatus()).isEqualTo(200);

        MvcResult replay = mockMvc.perform(post("/api/auth/oauth2-login").cookie(cookie)).andReturn();

        assertThat(replay.getResponse().getStatus())
                .as("a consumed login ticket must not be usable a second time")
                .isEqualTo(400);
        assertThat(replay.getResponse().getContentAsString()).contains("\"code\":1049");
    }

    // ---------- Concurrent exchange of the same ticket ----------

    /**
     * Two requests race to exchange the SAME ticket (e.g. a double page load, or the redirect page
     * rendering twice). OAuth2LoginTicketRepository#consumeIfValid takes a Postgres row lock on UPDATE,
     * so exactly one of the two concurrent calls can ever see itself as the winner.
     */
    @Test
    void concurrentExchangesOfTheSameTicketYieldExactlyOneSuccess() throws Exception {
        User user = user("racing@gmail.com", true);
        String token = loginTicket(user.getId(), OAuth2LoginTicketCookie.TTL);

        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(2);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        Callable<AuthResponse> task = () -> {
            try {
                startLatch.await();
                return authService.exchangeOAuth2Login(token);
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

        assertThat(succeeded).as("exactly one of the two concurrent exchanges wins").isEqualTo(1);
        assertThat(rejected).isEqualTo(1);
    }

    // ---------- Account status re-checked at exchange time ----------

    @Test
    void lockedAccountCannotExchangeItsTicketForAJwt() throws Exception {
        User user = user("locked@gmail.com", false);
        String token = loginTicket(user.getId(), OAuth2LoginTicketCookie.TTL);

        MvcResult result = exchange(token);

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString())
                .as("a locked account must never receive a JWT via ticket exchange")
                .doesNotContain("\"token\"")
                .contains("\"code\":1049");
    }

    @Test
    void deletedAccountCannotExchangeItsTicketForAJwt() throws Exception {
        User user = user("about-to-be-deleted@gmail.com", true);
        String token = loginTicket(user.getId(), OAuth2LoginTicketCookie.TTL);
        userRepository.delete(user);

        MvcResult result = exchange(token);

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1049");
    }

    // ---------- The two ticket types are not interchangeable ----------

    @Test
    void aRegistrationTicketCannotBeUsedAtTheLoginExchangeEndpoint() throws Exception {
        // A registration ticket's token lives in a different table/repository entirely, so it simply
        // will never be found by the login exchange's lookup - this proves that, not just that it fails.
        String token = OAuth2RegistrationTicketCookie.generateToken();
        registrationTicketRepository.save(OAuth2RegistrationTicket.builder()
                .token(token).email("someone@gmail.com").fullName("Someone").avatarUrl(null)
                .expiresAt(LocalDateTime.now().plus(OAuth2RegistrationTicketCookie.TTL))
                .build());

        MvcResult result = exchange(token);

        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1049");
    }

    @Test
    void aLoginTicketCannotBeUsedAtTheRegistrationEndpoint() throws Exception {
        User user = user("existing-for-cross-check@gmail.com", true);
        String token = loginTicket(user.getId(), OAuth2LoginTicketCookie.TTL);

        MvcResult result = mockMvc.perform(post("/api/auth/oauth2-register")
                .cookie(new Cookie(OAuth2RegistrationTicketCookie.COOKIE_NAME, token))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"role\":\"STUDENT\"}")).andReturn();

        assertThat(result.getResponse().getStatus())
                .as("a login ticket's token must not double as a registration ticket, even by coincidence "
                        + "of being sent under the registration cookie name")
                .isEqualTo(400);
        assertThat(result.getResponse().getContentAsString()).contains("\"code\":1047");
    }
}

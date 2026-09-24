package com.example.quizhub.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.LocalDateTime;

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

import com.example.quizhub.entity.OAuth2LoginTicket;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.OAuth2LoginTicketRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.security.OAuth2LoginTicketCookie;

import jakarta.servlet.http.Cookie;

/**
 * HTTPS behind a reverse proxy the deployment has declared trusted: with server.forward-headers-strategy
 * set, the container (not app code) applies X-Forwarded-Proto, request.isSecure() becomes true, and the
 * login-ticket cookie gets Secure. "framework" is used here because MockMvc runs no Tomcat valves; in a
 * real deployment where the app port is reachable without the proxy, "native" plus
 * server.tomcat.remoteip.internal-proxies restricted to the proxy's address is what makes that trust safe.
 */
@SpringBootTest(properties = {
        "app.jwt.secret=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "server.forward-headers-strategy=framework" })
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class OAuth2LoginTrustedProxyCookieIntegrationTest {

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

    @BeforeEach
    void seed() {
        loginTicketRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void aTrustedProxysForwardedHttpsMakesTheCookieSecure() throws Exception {
        User user = userRepository.save(User.builder()
                .email("behind-proxy@gmail.com").password(passwordEncoder.encode("x")).fullName("Proxied User")
                .role(Role.STUDENT).isEnable(true).isVerified(true).build());
        String token = OAuth2LoginTicketCookie.generateToken();
        loginTicketRepository.save(OAuth2LoginTicket.builder()
                .token(token).userId(user.getId())
                .expiresAt(LocalDateTime.now().plus(OAuth2LoginTicketCookie.TTL)).build());

        MvcResult result = mockMvc.perform(post("/api/auth/oauth2-login")
                .cookie(new Cookie(OAuth2LoginTicketCookie.COOKIE_NAME, token))
                .header("X-Forwarded-Proto", "https")).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getHeaders("Set-Cookie"))
                .filteredOn(h -> h.startsWith(OAuth2LoginTicketCookie.COOKIE_NAME + "="))
                .singleElement()
                .satisfies(h -> assertThat(h).containsPattern("(?i);\\s*Secure\\s*(;|$)")
                        .containsIgnoringCase("HttpOnly").containsIgnoringCase("SameSite=Lax"));
    }
}

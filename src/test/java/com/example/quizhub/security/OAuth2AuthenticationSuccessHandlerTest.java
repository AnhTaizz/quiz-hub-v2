package com.example.quizhub.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.OAuth2RegistrationTicketRepository;
import com.example.quizhub.repository.UserRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Unit-level coverage (no Spring context, no real Google account) for
 * OAuth2AuthenticationSuccessHandler's identity validation, using a mocked OAuth2User the way Spring
 * Security hands one back after a real token exchange with Google. This is the "test double / mocked
 * provider response" the task calls for in place of real Google credentials.
 *
 * Before this fix, the handler trusted oAuth2User.getAttribute("email") unconditionally: a missing
 * email, or one Google marked as NOT verified, still proceeded down the "new user" path and redirected
 * to the choose-role page.
 */
class OAuth2AuthenticationSuccessHandlerTest {

    private UserRepository userRepository;
    private JwtService jwtService;
    private OAuth2AuthenticationSuccessHandler handler;
    private HttpServletRequest request;
    private HttpServletResponse response;

    @BeforeEach
    void setUp() throws Exception {
        jwtService = mock(JwtService.class);
        userRepository = mock(UserRepository.class);
        OAuth2RegistrationTicketRepository ticketRepository = mock(OAuth2RegistrationTicketRepository.class);
        handler = new OAuth2AuthenticationSuccessHandler(jwtService, userRepository, ticketRepository);

        request = mock(HttpServletRequest.class);
        response = mock(HttpServletResponse.class);
        when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
        // DefaultRedirectStrategy (used internally by SimpleUrlAuthenticationSuccessHandler) calls
        // response.encodeRedirectURL(url) and redirects to ITS return value, not the original url. An
        // unstubbed mock returns null here, which would make every sendRedirect(...) call arrive as
        // sendRedirect(null) - silently defeating any contains(...)-based verification below. Echo the
        // input back so the real target URL is what we actually observe.
        when(response.encodeRedirectURL(org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private Authentication authFor(Map<String, Object> attributes) {
        OAuth2User oAuth2User = new DefaultOAuth2User(List.of(), attributes, "sub");
        Authentication auth = mock(Authentication.class);
        when(auth.getPrincipal()).thenReturn(oAuth2User);
        return auth;
    }

    @Test
    void missingEmailMustNotProceedToChooseRole() throws Exception {
        when(userRepository.findByEmail(null)).thenReturn(Optional.empty());
        // "name" present (so a pre-fix build's null-email fallback-to-name path doesn't NPE) but
        // deliberately no "email" attribute at all - isolates the missing-email case from that
        // unrelated crash.
        Authentication auth = authFor(Map.of("sub", "12345", "name", "No Email User"));

        handler.onAuthenticationSuccess(request, response, auth);

        verify(response, never()).sendRedirect(contains("oauth2-choose-role"));
    }

    @Test
    void unverifiedEmailMustNotProceedToChooseRole() throws Exception {
        when(userRepository.findByEmail("unverified@gmail.com")).thenReturn(Optional.empty());
        Authentication auth = authFor(Map.of(
                "sub", "12345", "email", "unverified@gmail.com", "email_verified", false));

        handler.onAuthenticationSuccess(request, response, auth);

        verify(response, never()).sendRedirect(contains("oauth2-choose-role"));
    }

    // ---------- RED (task: harden existing-user Google login) ----------
    //
    // A real Google callback for an email that already has an enabled account. The handler currently
    // generates a real JWT and puts it - plus id/email/fullName/role/avatarUrl - directly into the
    // /oauth2-redirect.html query string of a server-side sendRedirect(). That URL then persists in
    // browser history, any reverse proxy/CDN access log that logs query strings (a common default), and
    // the Referer header of any subresource request that races the client-side history.replaceState().
    //
    // FAKE_JWT_MARKER below is never a real signed JWT - JwtService itself is mocked, so no real signing
    // key or token value is ever produced or logged by this test.

    private static final String FAKE_JWT_MARKER = "FAKE.JWT.MARKER.NOT-A-REAL-TOKEN";

    private User existingEnabledUser() {
        return User.builder()
                .id(42L)
                .email("existing.user@gmail.com")
                .fullName("Existing User")
                .role(Role.STUDENT)
                .avatarUrl("https://example.test/avatar.png")
                .isEnable(true)
                .isVerified(true)
                .password("irrelevant-for-oauth2-login")
                .build();
    }

    @Test
    void existingEnabledUserLoginMustNotPutTheJwtInTheRedirectUrl() throws Exception {
        User user = existingEnabledUser();
        when(userRepository.findByEmail("existing.user@gmail.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(user)).thenReturn(FAKE_JWT_MARKER);
        Authentication auth = authFor(Map.of(
                "sub", "g-42", "email", "existing.user@gmail.com", "email_verified", true,
                "name", "Existing User"));

        handler.onAuthenticationSuccess(request, response, auth);

        ArgumentCaptor<String> redirectCaptor = ArgumentCaptor.forClass(String.class);
        verify(response).sendRedirect(redirectCaptor.capture());
        String redirectUrl = redirectCaptor.getValue();

        assertThat(redirectUrl)
                .as("the JWT must never appear as a URL query parameter on the OAuth2 redirect")
                .doesNotContain(FAKE_JWT_MARKER)
                .doesNotContain("token=");
    }

    @Test
    void existingEnabledUserLoginMustNotPutIdentityFieldsInTheRedirectUrl() throws Exception {
        User user = existingEnabledUser();
        when(userRepository.findByEmail("existing.user@gmail.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken(user)).thenReturn(FAKE_JWT_MARKER);
        Authentication auth = authFor(Map.of(
                "sub", "g-42", "email", "existing.user@gmail.com", "email_verified", true,
                "name", "Existing User"));

        handler.onAuthenticationSuccess(request, response, auth);

        ArgumentCaptor<String> redirectCaptor = ArgumentCaptor.forClass(String.class);
        verify(response).sendRedirect(redirectCaptor.capture());
        String redirectUrl = redirectCaptor.getValue();

        assertThat(redirectUrl)
                .as("no account identity may be carried in the OAuth2 redirect URL - it must be a bare "
                        + "redirect to /oauth2-redirect.html, with any session handoff happening out of band")
                .isEqualTo("/oauth2-redirect.html");
    }
}

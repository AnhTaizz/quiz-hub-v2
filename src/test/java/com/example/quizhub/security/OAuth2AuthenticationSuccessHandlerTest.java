package com.example.quizhub.security;

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
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

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
    private OAuth2AuthenticationSuccessHandler handler;
    private HttpServletRequest request;
    private HttpServletResponse response;

    @BeforeEach
    void setUp() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        userRepository = mock(UserRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        handler = new OAuth2AuthenticationSuccessHandler(jwtService, userRepository, passwordEncoder);

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
}

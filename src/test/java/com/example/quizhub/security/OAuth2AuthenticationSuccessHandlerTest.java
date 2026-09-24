package com.example.quizhub.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.any;
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

import com.example.quizhub.entity.OAuth2LoginTicket;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.OAuth2LoginTicketRepository;
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
    private OAuth2LoginTicketRepository loginTicketRepository;
    private OAuth2AuthenticationSuccessHandler handler;
    private HttpServletRequest request;
    private HttpServletResponse response;

    @BeforeEach
    void setUp() throws Exception {
        userRepository = mock(UserRepository.class);
        OAuth2RegistrationTicketRepository ticketRepository = mock(OAuth2RegistrationTicketRepository.class);
        loginTicketRepository = mock(OAuth2LoginTicketRepository.class);
        handler = new OAuth2AuthenticationSuccessHandler(userRepository, ticketRepository, loginTicketRepository);

        request = mock(HttpServletRequest.class);
        // DefaultRedirectStrategy prepends request.getContextPath() to the target URL. An unstubbed mock
        // returns null, and Java string concatenation turns that into a literal "null" prefix (e.g.
        // "null/oauth2-redirect.html") - a test-fixture artifact, not anything a real servlet container
        // does (root-context deployments return "", never null). Stub it to "" so the exact-match
        // assertions below observe the real target URL.
        when(request.getContextPath()).thenReturn("");
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

    // ---------- Existing-user Google login: no JWT or identity in the redirect URL ----------
    //
    // A real Google callback for an email that already has an enabled account. Before this fix, the
    // handler generated a real JWT here and put it - plus id/email/fullName/role/avatarUrl - directly
    // into the /oauth2-redirect.html query string of a server-side sendRedirect(). That URL then
    // persisted in browser history, any reverse proxy/CDN access log that logs query strings (a common
    // default), and the Referer header of any subresource request that raced the client-side
    // history.replaceState(). The RED evidence for this (this test class's git history, pre-fix commit)
    // asserted exactly the two things below and failed against the pre-fix handler: the redirect
    // contained "token=" and the full identity querystring instead of a bare path.
    //
    // The fix moves JWT issuance out of this class entirely (see AuthServiceImpl#exchangeOAuth2Login) -
    // this handler now only proves "a real Google callback happened for this existing user id" by minting
    // a single-use OAuth2LoginTicket and handing its token to the browser as an HttpOnly cookie.

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

    private Authentication existingUserAuth() {
        return authFor(Map.of(
                "sub", "g-42", "email", "existing.user@gmail.com", "email_verified", true,
                "name", "Existing User"));
    }

    @Test
    void existingEnabledUserLoginRedirectsToABarePathWithNoJwtOrIdentity() throws Exception {
        when(userRepository.findByEmail("existing.user@gmail.com")).thenReturn(Optional.of(existingEnabledUser()));

        handler.onAuthenticationSuccess(request, response, existingUserAuth());

        ArgumentCaptor<String> redirectCaptor = ArgumentCaptor.forClass(String.class);
        verify(response).sendRedirect(redirectCaptor.capture());

        assertThat(redirectCaptor.getValue())
                .as("no JWT or account identity may be carried in the OAuth2 redirect URL - it must be a "
                        + "bare redirect to /oauth2-redirect.html, with the JWT handed over out of band")
                .isEqualTo("/oauth2-redirect.html");
    }

    @Test
    void existingEnabledUserLoginIssuesASingleUseLoginTicketBoundToThatUserId() throws Exception {
        User user = existingEnabledUser();
        when(userRepository.findByEmail("existing.user@gmail.com")).thenReturn(Optional.of(user));

        handler.onAuthenticationSuccess(request, response, existingUserAuth());

        ArgumentCaptor<OAuth2LoginTicket> ticketCaptor = ArgumentCaptor.forClass(OAuth2LoginTicket.class);
        verify(loginTicketRepository).save(ticketCaptor.capture());
        assertThat(ticketCaptor.getValue().getUserId()).isEqualTo(user.getId());

        ArgumentCaptor<String> headerCaptor = ArgumentCaptor.forClass(String.class);
        verify(response).addHeader(org.mockito.ArgumentMatchers.eq("Set-Cookie"), headerCaptor.capture());
        assertThat(headerCaptor.getValue())
                .as("the ticket must travel as an HttpOnly cookie, never a URL or response body field")
                .contains(OAuth2LoginTicketCookie.COOKIE_NAME + "=")
                .containsIgnoringCase("HttpOnly")
                .containsIgnoringCase("SameSite=Lax");
    }

    @Test
    void lockedExistingUserLoginIssuesNoTicketAtAll() throws Exception {
        User locked = User.builder()
                .id(43L).email("locked.user@gmail.com").fullName("Locked User")
                .role(Role.STUDENT).isEnable(false).isVerified(true).password("x").build();
        when(userRepository.findByEmail("locked.user@gmail.com")).thenReturn(Optional.of(locked));
        Authentication auth = authFor(Map.of(
                "sub", "g-43", "email", "locked.user@gmail.com", "email_verified", true));

        handler.onAuthenticationSuccess(request, response, auth);

        verify(loginTicketRepository, never()).save(any());
    }
}

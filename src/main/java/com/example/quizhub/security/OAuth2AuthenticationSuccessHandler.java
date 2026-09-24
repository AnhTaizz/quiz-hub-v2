package com.example.quizhub.security;

import com.example.quizhub.entity.OAuth2LoginTicket;
import com.example.quizhub.entity.OAuth2RegistrationTicket;
import com.example.quizhub.entity.User;
import com.example.quizhub.repository.OAuth2LoginTicketRepository;
import com.example.quizhub.repository.OAuth2RegistrationTicketRepository;
import com.example.quizhub.repository.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Optional;

import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final OAuth2RegistrationTicketRepository oauth2RegistrationTicketRepository;
    private final OAuth2LoginTicketRepository oauth2LoginTicketRepository;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");
        String picture = oAuth2User.getAttribute("picture");
        // Google's userinfo response includes this; false only for edge-case/misconfigured identities -
        // Google's own consent flow otherwise only ever returns verified-account emails. Defense in depth:
        // a missing attribute (older/non-Google-shaped OAuth2User) is NOT treated as "unverified", only an
        // explicit false is.
        Boolean emailVerified = oAuth2User.getAttribute("email_verified");

        if (email == null || Boolean.FALSE.equals(emailVerified)) {
            log.warn("OAuth2 login rejected: missing or unverified email");
            redirectWithError(request, response, "Không thể xác minh địa chỉ email từ Google");
            return;
        }

        Optional<User> userOptional = userRepository.findByEmail(email);
        log.info("OAuth2 Login - Email: {}", email);
        log.info("User exists in DB: {}", userOptional.isPresent());

        if (userOptional.isEmpty()) {
            log.info("Issuing registration ticket for email: {}", email);
            OAuth2RegistrationTicket ticket = OAuth2RegistrationTicket.builder()
                    .token(OAuth2RegistrationTicketCookie.generateToken())
                    .email(email)
                    .fullName(name != null ? name : email)
                    .avatarUrl(picture)
                    .expiresAt(LocalDateTime.now().plus(OAuth2RegistrationTicketCookie.TTL))
                    .build();
            oauth2RegistrationTicketRepository.save(ticket);

            ResponseCookie cookie = OAuth2RegistrationTicketCookie.issue(ticket.getToken(), request.isSecure());
            response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
            // No identity in the URL at all - the choose-role page fetches a display-only preview via
            // GET /api/auth/oauth2-register/pending, which reads the same cookie server-side.
            getRedirectStrategy().sendRedirect(request, response, "/oauth2-choose-role.html");
            return;
        }

        User user = userOptional.get();
        log.info("User role: {}", user.getRole());

        if (!user.getIsEnable()) {
            redirectWithError(request, response, "Tài khoản đã bị khóa");
            return;
        }

        // No JWT or identity in the URL: a single-use, short-lived login ticket is bound to this user id
        // server-side and handed to the browser only as an HttpOnly cookie. The redirect target is a bare
        // path - /oauth2-redirect.html fetches the actual JWT via POST /api/auth/oauth2-login, which reads
        // the same cookie and exchanges it for an AuthResponse in the JSON body only (see
        // docs/backend/OAUTH2_EXISTING_LOGIN_SECURITY.md).
        log.info("Issuing login ticket for existing user id: {}", user.getId());
        OAuth2LoginTicket ticket = OAuth2LoginTicket.builder()
                .token(OAuth2LoginTicketCookie.generateToken())
                .userId(user.getId())
                .expiresAt(LocalDateTime.now().plus(OAuth2LoginTicketCookie.TTL))
                .build();
        oauth2LoginTicketRepository.save(ticket);

        ResponseCookie cookie = OAuth2LoginTicketCookie.issue(
                ticket.getToken(), OAuth2LoginTicketCookie.isEffectivelySecure(request));
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        getRedirectStrategy().sendRedirect(request, response, "/oauth2-redirect.html");
    }

    private void redirectWithError(HttpServletRequest request, HttpServletResponse response, String message)
            throws IOException {
        getRedirectStrategy().sendRedirect(request, response,
                "/oauth2-redirect.html?error=" + URLEncoder.encode(message, StandardCharsets.UTF_8));
    }
}

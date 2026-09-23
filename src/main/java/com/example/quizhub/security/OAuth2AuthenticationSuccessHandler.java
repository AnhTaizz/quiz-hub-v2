package com.example.quizhub.security;

import com.example.quizhub.entity.OAuth2RegistrationTicket;
import com.example.quizhub.entity.User;
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
import java.util.Base64;
import java.util.Optional;

import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final OAuth2RegistrationTicketRepository oauth2RegistrationTicketRepository;

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

        // Existing-user login still hands the JWT to the browser via a URL query parameter on this
        // server-side redirect. That is a separate, pre-existing risk from the one this sprint closes
        // (unauthenticated account creation) and is documented, unfixed, in this sprint's report.
        String token = jwtService.generateToken(user);
        String base64Name = Base64.getEncoder().encodeToString(user.getFullName().getBytes(StandardCharsets.UTF_8));

        String targetUrl = org.springframework.web.util.UriComponentsBuilder.fromUriString("/oauth2-redirect.html")
                .queryParam("token", token)
                .queryParam("id", user.getId())
                .queryParam("email", user.getEmail())
                .queryParam("fullName", base64Name)
                .queryParam("role", user.getRole().name())
                .queryParam("avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "")
                .build().encode().toUriString();

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    private void redirectWithError(HttpServletRequest request, HttpServletResponse response, String message)
            throws IOException {
        getRedirectStrategy().sendRedirect(request, response,
                "/oauth2-redirect.html?error=" + URLEncoder.encode(message, StandardCharsets.UTF_8));
    }
}

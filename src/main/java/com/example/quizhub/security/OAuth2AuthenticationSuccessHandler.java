package com.example.quizhub.security;

import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;

import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");
        String picture = oAuth2User.getAttribute("picture");

        Optional<User> userOptional = userRepository.findByEmail(email);
        log.info("OAuth2 Login - Email: {}", email);
        log.info("User exists in DB: {}", userOptional.isPresent());

        if (userOptional.isEmpty()) {
            log.info("Redirecting to Choose Role page for email: {}", email);
            String base64Name = Base64.getEncoder().encodeToString((name != null ? name : email).getBytes(StandardCharsets.UTF_8));
            String chooseRoleUrl = UriComponentsBuilder.fromUriString("/oauth2-choose-role.html")
                    .queryParam("email", email)
                    .queryParam("fullName", base64Name)
                    .queryParam("avatarUrl", picture != null ? picture : "")
                    .build().encode().toUriString();
            getRedirectStrategy().sendRedirect(request, response, chooseRoleUrl);
            return;
        }

        User user = userOptional.get();
        log.info("User role: {}", user.getRole());

        if (!user.getIsEnable()) {
            getRedirectStrategy().sendRedirect(request, response, "/oauth2-redirect.html?error=" + URLEncoder.encode("Tài khoản đã bị khóa", StandardCharsets.UTF_8));
            return;
        }

        String token = jwtService.generateToken(user);
        String base64Name = Base64.getEncoder().encodeToString(user.getFullName().getBytes(StandardCharsets.UTF_8));
        
        String targetUrl = UriComponentsBuilder.fromUriString("/oauth2-redirect.html")
                .queryParam("token", token)
                .queryParam("id", user.getId())
                .queryParam("email", user.getEmail())
                .queryParam("fullName", base64Name)
                .queryParam("role", user.getRole().name())
                .queryParam("avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "")
                .build().encode().toUriString();

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}

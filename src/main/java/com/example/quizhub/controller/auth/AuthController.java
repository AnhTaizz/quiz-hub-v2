package com.example.quizhub.controller.auth;

import java.security.Principal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.auth.response.AuthResponse;
import com.example.quizhub.dto.auth.response.OAuth2PendingRegistrationResponse;
import com.example.quizhub.security.OAuth2LoginTicketCookie;
import com.example.quizhub.security.OAuth2RegistrationTicketCookie;
import com.example.quizhub.service.AuthService;
import com.example.quizhub.dto.auth.request.AuthRequest;
import com.example.quizhub.dto.auth.request.OAuth2RegisterRequest;
import com.example.quizhub.dto.auth.request.RegisterRequest;
import com.example.quizhub.dto.auth.request.ResetPasswordRequest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin("*")
public class AuthController {
    private final AuthService authService;

    @Value("${app.security.cookie-force-secure:false}")
    private boolean forceSecureCookies;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest registerRequest) {
        return ResponseEntity.ok(authService.register(registerRequest));
    }

    /**
     * Identity comes from OAuth2RegistrationTicketCookie.COOKIE_NAME, set only by
     * OAuth2AuthenticationSuccessHandler after a real Google login - never from the request body. The ticket
     * is single-use, so the cookie is cleared here on success regardless (it is already consumed
     * server-side; clearing it is just hygiene, not part of the security guarantee).
     */
    @PostMapping("/oauth2-register")
    public ResponseEntity<AuthResponse> oauth2Register(
            @Valid @RequestBody OAuth2RegisterRequest oauth2RegisterRequest,
            @CookieValue(name = OAuth2RegistrationTicketCookie.COOKIE_NAME, required = false) String ticketToken,
            HttpServletRequest request) {
        AuthResponse response = authService.registerOAuth2(ticketToken, oauth2RegisterRequest);
        ResponseCookie cleared = OAuth2RegistrationTicketCookie.clear(request.isSecure());
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cleared.toString()).body(response);
    }

    /** Read-only preview for the choose-role page ("Signed in as X"). Does not consume the ticket. */
    @GetMapping("/oauth2-register/pending")
    public ResponseEntity<OAuth2PendingRegistrationResponse> pendingOAuth2Registration(
            @CookieValue(name = OAuth2RegistrationTicketCookie.COOKIE_NAME, required = false) String ticketToken) {
        return ResponseEntity.ok(authService.getPendingOAuth2Registration(ticketToken));
    }

    /**
     * Identity comes from OAuth2LoginTicketCookie.COOKIE_NAME, set only by
     * OAuth2AuthenticationSuccessHandler after a real Google login for an EXISTING, enabled account -
     * never from the request (there is no request body: nothing the client could supply would be
     * meaningful here). The ticket is single-use and is cleared here on success regardless (it is already
     * consumed server-side; clearing it is hygiene, not part of the security guarantee).
     * Cache-Control: no-store so the JWT-bearing body is never written to a shared/browser cache.
     */
    @PostMapping("/oauth2-login")
    public ResponseEntity<AuthResponse> exchangeOAuth2Login(
            @CookieValue(name = OAuth2LoginTicketCookie.COOKIE_NAME, required = false) String ticketToken,
            HttpServletRequest request) {
        AuthResponse response = authService.exchangeOAuth2Login(ticketToken);
        ResponseCookie cleared = OAuth2LoginTicketCookie.clear(
                OAuth2LoginTicketCookie.shouldBeSecure(request, forceSecureCookies));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cleared.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(response);
    }

    @GetMapping("/check-email")
    public ResponseEntity<Boolean> checkEmail(@RequestParam String email) {
        return ResponseEntity.ok(authService.existsByEmail(email));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest authRequest) {
        return ResponseEntity.ok(authService.login(authRequest));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<String> forgotPassword(@Valid @RequestParam String email) {
        authService.forgotPassword(email);
        return ResponseEntity.ok("Mã OTP đã được gửi đến email của bạn!");
    }

    @PostMapping("/reset-password")
    public ResponseEntity<String> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok("Đặt lại mật khẩu thành công!");
    }
}

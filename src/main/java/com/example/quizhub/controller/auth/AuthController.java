package com.example.quizhub.controller.auth;

import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.auth.response.AuthResponse;
import com.example.quizhub.service.AuthService;
import com.example.quizhub.dto.auth.request.AuthRequest;
import com.example.quizhub.dto.auth.request.OAuth2RegisterRequest;
import com.example.quizhub.dto.auth.request.RegisterRequest;
import com.example.quizhub.dto.auth.request.ResetPasswordRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin("*")
public class AuthController {
    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest registerRequest) {
        return ResponseEntity.ok(authService.register(registerRequest));
    }

    @PostMapping("/oauth2-register")
    public ResponseEntity<AuthResponse> oauth2Register(@Valid @RequestBody OAuth2RegisterRequest oauth2RegisterRequest) {
        return ResponseEntity.ok(authService.registerOAuth2(oauth2RegisterRequest));
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

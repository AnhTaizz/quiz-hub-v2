package com.example.quizhub.service;

import org.springframework.stereotype.Service;

import com.example.quizhub.dto.auth.response.AuthResponse;
import com.example.quizhub.dto.auth.request.AuthRequest;
import com.example.quizhub.dto.auth.request.OAuth2RegisterRequest;
import com.example.quizhub.dto.auth.request.RegisterRequest;
import com.example.quizhub.dto.auth.request.ResetPasswordRequest;

@Service
public interface AuthService {
    AuthResponse register(RegisterRequest request);

    AuthResponse registerOAuth2(OAuth2RegisterRequest request);

    AuthResponse login(AuthRequest request);

    void forgotPassword(String email);

    void resetPassword(ResetPasswordRequest request);

    boolean existsByEmail(String email);
}

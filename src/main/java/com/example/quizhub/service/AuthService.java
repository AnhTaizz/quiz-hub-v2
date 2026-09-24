package com.example.quizhub.service;

import org.springframework.stereotype.Service;

import com.example.quizhub.dto.auth.response.AuthResponse;
import com.example.quizhub.dto.auth.response.OAuth2PendingRegistrationResponse;
import com.example.quizhub.dto.auth.request.AuthRequest;
import com.example.quizhub.dto.auth.request.OAuth2RegisterRequest;
import com.example.quizhub.dto.auth.request.RegisterRequest;
import com.example.quizhub.dto.auth.request.ResetPasswordRequest;

@Service
public interface AuthService {
    AuthResponse register(RegisterRequest request);

    /**
     * Completes registration for the identity bound server-side to ticketToken. Only request.getRole() is
     * ever read from the client; email/fullName/avatarUrl come from the ticket, never the request.
     */
    AuthResponse registerOAuth2(String ticketToken, OAuth2RegisterRequest request);

    /** Read-only preview of the pending registration for display; does not consume the ticket. */
    OAuth2PendingRegistrationResponse getPendingOAuth2Registration(String ticketToken);

    /**
     * Completes an existing-user Google login for the account bound server-side to ticketToken (issued
     * by OAuth2AuthenticationSuccessHandler right after a real Google callback for that user). Re-checks
     * the account still exists and is still enabled at exchange time - a ticket issued for an account
     * that is locked or deleted between issuance and exchange must never yield a JWT.
     */
    AuthResponse exchangeOAuth2Login(String ticketToken);

    AuthResponse login(AuthRequest request);

    void forgotPassword(String email);

    void resetPassword(ResetPasswordRequest request);

    boolean existsByEmail(String email);
}

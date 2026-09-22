package com.example.quizhub.dto.auth.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Only the caller's deliberate choice goes here. Identity (email/fullName/avatarUrl) is never accepted from
 * the client - it is resolved server-side from the OAuth2RegistrationTicket bound to the request's cookie.
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OAuth2RegisterRequest {
    @NotBlank(message = "Role is required")
    private String role;
}

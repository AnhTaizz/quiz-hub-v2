package com.example.quizhub.dto.auth.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResetPasswordRequest {
    @NotBlank(message = "BLANK_FIELD")
    @Email(message = "INVALID_EMAIL")
    private String email;
    @NotBlank(message = "BLANK_FIELD")
    private String otp;
    @NotBlank(message = "BLANK_FIELD")
    private String newPassword;
    @NotBlank(message = "BLANK_FIELD")
    private String confirmPassword;
}

package com.example.quizhub.dto.auth.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {
    @NotBlank(message = "BLANK_FIELD")
    private String fullName;
    @NotBlank(message = "BLANK_FIELD")
    @Email(message = "INVALID_EMAIL")
    @Pattern(regexp = "^[a-zA-Z0-9_!#$%&'*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$", message = "INVALID_EMAIL")
    private String email;
    @NotBlank(message = "BLANK_FIELD")
    @Size(min = 6, message = "INVALID_PASSWORD")
    private String password;
    @NotBlank(message = "BLANK_FIELD")
    private String confirmPassword;

    private String role;
}

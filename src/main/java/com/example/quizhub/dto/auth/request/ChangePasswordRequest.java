package com.example.quizhub.dto.auth.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ChangePasswordRequest {
    @NotBlank(message = "BLANK_FIELD")
    private String oldPassword;
    @NotBlank(message = "BLANK_FIELD")
    @Size(min = 6, message = "INVALID_PASSWORD")
    private String newPassword;
    @NotBlank(message = "BLANK_FIELD")
    @Size(min = 6, message = "INVALID_PASSWORD")
    private String confirmNewPassword;
}

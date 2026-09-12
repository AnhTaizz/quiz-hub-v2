package com.example.quizhub.dto.user.request;

import com.example.quizhub.entity.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateUserRequest {
    @NotBlank(message = "BLANK_FIELD")
    private String fullName;

    @NotBlank(message = "BLANK_FIELD")
    @Email(message = "INVALID_EMAIL")
    @Pattern(regexp = "^[a-zA-Z0-9_!#$%&'*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$", message = "INVALID_EMAIL")
    private String email;

    @NotBlank(message = "BLANK_FIELD")
    @Size(min = 6, message = "INVALID_PASSWORD")
    private String password;

    private Role role;
}


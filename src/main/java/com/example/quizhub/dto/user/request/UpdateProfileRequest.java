package com.example.quizhub.dto.user.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @NotBlank(message = "Họ tên không được để trống!")
    private String fullName;

    private String phone;
    private String avatarUrl;
}
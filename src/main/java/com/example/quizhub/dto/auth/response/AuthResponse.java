package com.example.quizhub.dto.auth.response;

import com.example.quizhub.entity.enums.Role;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private Long id;
    private String email;
    private String fullName;
    private Role role;
    private String token;
    private String avatarUrl;
}

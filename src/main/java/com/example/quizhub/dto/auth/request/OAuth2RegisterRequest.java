package com.example.quizhub.dto.auth.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OAuth2RegisterRequest {
    private String email;
    private String fullName;
    private String avatarUrl;
    private String role;
}

package com.example.quizhub.dto.user.response;

import com.example.quizhub.entity.enums.Role;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserProfileResponse {
    private Long id;
    private String email;
    private String fullName;
    private String phone;
    private String avatarUrl;
    private Role role;
    private Boolean isEnable;
}
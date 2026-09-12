package com.example.quizhub.dto.user.response;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class UserResponseDTO {
    private Long id;
    private String fullName;
    private String email;
    private String role;
}

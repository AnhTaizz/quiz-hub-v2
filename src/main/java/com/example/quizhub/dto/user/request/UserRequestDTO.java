package com.example.quizhub.dto.user.request;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserRequestDTO {
    private String fullName;
    private String email;
    private String password;
    private String role;
}

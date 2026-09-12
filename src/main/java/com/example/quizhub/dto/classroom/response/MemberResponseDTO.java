package com.example.quizhub.dto.classroom.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class MemberResponseDTO {
    private Long studentId;
    private String fullName;
    private String email;
    private String phone;
    private LocalDateTime joinedAt;
}
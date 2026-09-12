package com.example.quizhub.dto.classroom.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class ClassroomResponseDTO {
    private Long id;
    private String name;
    private String description;
    private String code;
    private String teacherName;
    private LocalDateTime createdAt;
}
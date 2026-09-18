package com.example.quizhub.dto.student;

import java.time.LocalDateTime;

import com.example.quizhub.entity.ClassJoining;
import com.example.quizhub.entity.enums.JoinStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentClassroomSummaryDTO {
    private Long id;
    private String code;
    private String name;
    private String description;
    private String imageUrl;
    private String teacherName;
    private JoinStatus joinStatus;
    private LocalDateTime joinedAt;

    public static StudentClassroomSummaryDTO fromJoining(ClassJoining joining) {
        var classroom = joining.getClassroom();
        return StudentClassroomSummaryDTO.builder()
                .id(classroom != null ? classroom.getId() : null)
                .code(classroom != null ? classroom.getCode() : null)
                .name(classroom != null ? classroom.getName() : null)
                .description(classroom != null ? classroom.getDescription() : null)
                .imageUrl(classroom != null ? classroom.getImageUrl() : null)
                .teacherName(classroom != null && classroom.getCreator() != null ? classroom.getCreator().getFullName() : null)
                .joinStatus(joining.getStatus())
                .joinedAt(joining.getJoinedAt())
                .build();
    }
}

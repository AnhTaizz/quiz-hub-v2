package com.example.quizhub.dto.teacher.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TeacherDashboardAssignmentDTO {
    Long assigningId;
    String classroomName;
    String quizTitle;
    Long violationCount;
    String status; // 'LIVE', 'UPCOMING', 'ENDED'
}

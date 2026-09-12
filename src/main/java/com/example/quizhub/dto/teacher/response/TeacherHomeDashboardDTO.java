package com.example.quizhub.dto.teacher.response;

import com.example.quizhub.entity.User;
import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class TeacherHomeDashboardDTO {
    private long classroomCount;
    private long questionCount;
    private long studentCount;
    private long liveQuizCount;
    private List<TeacherDashboardAssignmentDTO> assignments;
    private User currentUser;
}

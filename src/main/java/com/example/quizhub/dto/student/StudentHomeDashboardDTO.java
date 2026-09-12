package com.example.quizhub.dto.student;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class StudentHomeDashboardDTO {
    private long totalCompleted;
    private BigDecimal quizAvg;
    private BigDecimal practiceAvg;
    private List<QuizDashboardInfoDTO> assignedQuizzes;
    private int pendingCount;
    private int pendingThisWeekCount;
}

package com.example.quizhub.dto.student;

import java.math.BigDecimal;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentDashboardResponseDTO {
    private String greeting;
    private long totalCompleted;
    private BigDecimal quizAvg;
    private BigDecimal practiceAvg;
    private int pendingCount;
    private int pendingThisWeekCount;
    private List<AssignedQuizSummaryDTO> assignedQuizzes;
}

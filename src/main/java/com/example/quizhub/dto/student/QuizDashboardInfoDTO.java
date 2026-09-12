package com.example.quizhub.dto.student;

import com.example.quizhub.entity.QuizAssigning;
import lombok.Data;

@Data
public class QuizDashboardInfoDTO {
    private QuizAssigning assigning;
    private int attemptsMade;
    private int attemptsLeft; // -1 for unlimited
    private boolean hasStarted;
    private boolean hasUnfinished;
}

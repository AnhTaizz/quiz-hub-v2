package com.example.quizhub.dto.student;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuizHistoryItemDTO {
    private Long attemptId;
    private BigDecimal result;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;

    private String quizTitle;
    private Long quizAssigningId;
    private String classroomName;
}

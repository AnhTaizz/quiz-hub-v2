package com.example.quizhub.dto.admin.response;

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
public class RecentAttemptResponse {
    private Long id;
    private String studentName;
    private String quizTitle;
    private BigDecimal score;
    private LocalDateTime startedAt;
    private String type; // QUIZ or PRACTICE
}

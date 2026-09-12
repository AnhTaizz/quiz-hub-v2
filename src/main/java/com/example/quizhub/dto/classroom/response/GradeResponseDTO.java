package com.example.quizhub.dto.classroom.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GradeResponseDTO {
    private Long studentId;
    private String fullName;
    private String email;
    private BigDecimal highestScore;
    private int attemptCount;
    private String status;
}

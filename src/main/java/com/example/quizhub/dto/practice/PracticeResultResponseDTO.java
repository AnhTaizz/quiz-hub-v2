package com.example.quizhub.dto.practice;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PracticeResultResponseDTO {
    Long practiceId;
    String categoryName;
    Integer totalQuestions;
    Integer correctAnswers;
    BigDecimal score;
    LocalDateTime createdAt;
    
    List<PracticeDetailResponseDTO> details;
}

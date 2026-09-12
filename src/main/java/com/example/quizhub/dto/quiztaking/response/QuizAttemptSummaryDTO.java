package com.example.quizhub.dto.quiztaking.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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
public class QuizAttemptSummaryDTO {
    Long id;
    BigDecimal result;
    Integer totalQuestNum;
    Integer correctNum;
    Integer incorrectNum;
    LocalDateTime startedAt;
    LocalDateTime endedAt;
}

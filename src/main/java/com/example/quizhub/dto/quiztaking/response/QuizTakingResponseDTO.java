package com.example.quizhub.dto.quiztaking.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class QuizTakingResponseDTO {
    Long attemptId;

    String quizTitle;
    Integer durationInMins;
    LocalDateTime startedAt;
    Long startedAtMillis;

    List<QuestionTakingResponseDTO> questions;
    Map<Long, List<Long>> selectedAnswers;
    Map<Long, String> selectedTexts;
}

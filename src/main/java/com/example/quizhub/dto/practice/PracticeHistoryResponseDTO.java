package com.example.quizhub.dto.practice;

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
public class PracticeHistoryResponseDTO {
    Long id;
    Long categoryId;
    String categoryName;
    Integer totalQuestions;
    Integer correctAnswers;
    Integer answeredQuestions;
    LocalDateTime createdAt;
    Boolean isCompleted;
    Boolean isRandom;
    Integer practiceLimit;
    Integer practiceOffset;
}

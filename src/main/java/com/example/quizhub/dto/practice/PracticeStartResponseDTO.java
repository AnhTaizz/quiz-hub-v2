package com.example.quizhub.dto.practice;

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
public class PracticeStartResponseDTO {
    List<PracticeQuestionResponseDTO> questions;
    Long practiceId;
    Long categoryId;
    String categoryName;
    String quizTitle;
}

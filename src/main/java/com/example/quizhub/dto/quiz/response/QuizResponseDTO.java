package com.example.quizhub.dto.quiz.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.example.quizhub.dto.question.QuestionResponseDTO;

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
public class QuizResponseDTO {
    UUID id;
    String title;
    String description;
    String imageUrl;
    Boolean isDraft;
    Boolean isEnable;
    Boolean isExam;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
    String categoryName;
    Long categoryId;

    List<QuestionResponseDTO> questions;
}

package com.example.quizhub.dto;

import java.util.List;

import com.example.quizhub.dto.question.QuestionRequestDTO;

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
public class QuizDTO {
    private String title;
    private String description;
    private String imageUrl;
    private Long categoryId;
    private List<QuestionRequestDTO> questions;
}

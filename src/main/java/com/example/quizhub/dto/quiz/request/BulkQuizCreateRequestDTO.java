package com.example.quizhub.dto.quiz.request;

import java.util.List;
import com.example.quizhub.dto.question.QuestionRequestDTO;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
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
public class BulkQuizCreateRequestDTO {
    @NotBlank(message = "Tên bài quiz không được để trống")
    String title;

    String description;

    Long categoryId;

    String imageUrl;

    @NotEmpty(message = "Bài quiz phải có ít nhất 1 câu hỏi")
    List<@Valid QuestionRequestDTO> questions;
}

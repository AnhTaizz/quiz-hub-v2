package com.example.quizhub.dto.quiz.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class QuizGenerateRequestDTO {

    @NotNull(message = "Category ID is required")
    Long categoryId;

    @NotBlank(message = "Title is required")
    String title;

    @NotBlank(message = "Method is required (RANDOM or RANGE)")
    String method; // "RANDOM" or "RANGE"

    // For RANDOM method
    Integer amount;

    // For RANGE method
    Integer offset;
    Integer limit;
}

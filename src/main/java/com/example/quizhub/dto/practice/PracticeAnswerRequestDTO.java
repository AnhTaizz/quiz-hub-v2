package com.example.quizhub.dto.practice;

import java.util.List;

import jakarta.validation.constraints.NotNull;
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
public class PracticeAnswerRequestDTO {

    @NotNull(message = "Question ID is required")
    Long questionId;

    // For SINGLE_CHOICE
    Long selectedAnswerId;

    // For MULTIPLE_CHOICE
    List<Long> selectedAnswerIds;

    // For FILL_IN_BLANK
    String selectedText;
}

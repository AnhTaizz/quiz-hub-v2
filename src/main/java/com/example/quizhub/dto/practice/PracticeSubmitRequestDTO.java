package com.example.quizhub.dto.practice;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
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
public class PracticeSubmitRequestDTO {

    @NotNull(message = "Category ID is required")
    Long categoryId;

    Long practiceId;

    @NotEmpty(message = "Answers list cannot be empty")
    List<@Valid PracticeAnswerRequestDTO> answers;
}

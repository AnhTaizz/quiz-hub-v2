package com.example.quizhub.dto.practice;

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
public class PracticeStartRequestDTO {

    @NotNull(message = "Category ID is required")
    Long categoryId;

    @NotNull(message = "Limit is required")
    Integer limit;

    Integer offset;

    Boolean isRandom;

    Boolean forceNew;

    Long practiceId;
}

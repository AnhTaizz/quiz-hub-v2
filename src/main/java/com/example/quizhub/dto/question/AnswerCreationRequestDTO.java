package com.example.quizhub.dto.question;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
public class AnswerCreationRequestDTO {
    @NotBlank(message = "Đáp án không được để trống")
    private String text;

    @JsonProperty("isCorrect")
    @JsonAlias({"correct"})
    @NotNull(message = "Trạng thái đúng sai không được null")
    @Builder.Default
    private Boolean correct = false; // Gán mặc định là false nếu FE quên gửi
}

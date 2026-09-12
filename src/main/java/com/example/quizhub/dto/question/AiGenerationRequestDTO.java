package com.example.quizhub.dto.question;

import com.example.quizhub.entity.enums.QuestionLevel;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
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
public class AiGenerationRequestDTO {

    @NotBlank(message = "Nội dung văn bản không được để trống")
    String text;

    @NotNull(message = "Số lượng câu hỏi không được để trống")
    @Min(value = 1, message = "Phải tạo ít nhất 1 câu hỏi")
    @Max(value = 50, message = "Tối đa 50 câu hỏi mỗi lần")
    Integer numberOfQuestions;

    @NotNull(message = "Độ khó không được để trống")
    QuestionLevel level;

    Long categoryId;
}

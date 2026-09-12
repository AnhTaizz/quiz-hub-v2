package com.example.quizhub.dto.quiz.request;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
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
public class QuizRequestDTO {
    @NotBlank(message = "Tên bài quiz không được để trống")
    String title;

    String description;

    Long categoryId;

    String imageUrl;

    @NotNull(message = "Bài quiz có ở trạng thái draft không")
    Boolean isDraft;

    @NotNull(message = "Bài quiz có ở trạng thái exam không")
    Boolean isExam;

    @NotEmpty(message = "Bài quiz phải có ít nhất 1 câu hỏi")
    List<Long> questionIds;
}

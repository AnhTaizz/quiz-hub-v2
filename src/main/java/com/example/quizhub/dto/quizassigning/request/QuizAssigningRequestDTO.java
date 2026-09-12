package com.example.quizhub.dto.quizassigning.request;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class QuizAssigningRequestDTO {
    @NotNull(message = "ID lớp học không được để trống")
    Long classroomId;
    @NotNull(message = "ID đề thi không được để trống")
    UUID quizId;

    String note;
    Integer maxAttempt;
    Boolean questionShuffled;
    Boolean answerShuffled;
    Boolean showAnswer;

    @NotNull(message = "Thời gian làm bài không được để trống")
    Integer durationInMins;

    LocalDateTime startDate;
    LocalDateTime dueDate;

    Long topicId;

    String assignedStudentIds;
}

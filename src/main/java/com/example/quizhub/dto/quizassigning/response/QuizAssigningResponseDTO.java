package com.example.quizhub.dto.quizassigning.response;

import java.time.LocalDateTime;
import java.util.UUID;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class QuizAssigningResponseDTO {
    Long id;
    String note;
    Integer maxAttempt;
    boolean questionShuffle;
    boolean answerShuffle;
    Boolean showAnswer;
    Integer durationInMins;
    LocalDateTime startDate;
    LocalDateTime dueDate;
    LocalDateTime createdAt;
    Boolean isHidden;

    Long classroomId;
    String classroomName;

    UUID quizId;
    String quizTitle;

    Long topicId;
    String topicName;

    String assignedStudentIds;
}

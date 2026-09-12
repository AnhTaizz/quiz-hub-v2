package com.example.quizhub.dto.student;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;

@Data
@Builder
public class AssignedQuizDTO {
    Long id; // quizAssigningId
    String title;
    Integer durationInMins;
    Integer questionCount;
    LocalDate dueDate;
    Integer maxAttempt;
    Long usedAttempt;
    String status; // NOT_STARTED, IN_PROGRESS, COMPLETED
}

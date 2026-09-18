package com.example.quizhub.dto.student;

import java.time.LocalDateTime;
import java.util.UUID;

import com.example.quizhub.entity.QuizAssigning;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * JSON-safe projection of {@link QuizDashboardInfoDTO} (which wraps the raw
 * {@code QuizAssigning} JPA entity). Exists only so the React SPA can consume
 * this data without serializing lazy entity graphs.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignedQuizSummaryDTO {
    private Long assigningId;
    private UUID quizId;
    private String quizTitle;
    private Long classroomId;
    private String classroomName;
    private LocalDateTime startDate;
    private LocalDateTime dueDate;
    private Integer durationInMins;
    private Integer maxAttempt;
    private int attemptsMade;
    private int attemptsLeft;
    private boolean hasStarted;
    private boolean hasUnfinished;

    public static AssignedQuizSummaryDTO fromDashboardInfo(QuizDashboardInfoDTO info) {
        var assigning = info.getAssigning();
        var quiz = assigning.getQuiz();
        var classroom = assigning.getClassroom();
        return AssignedQuizSummaryDTO.builder()
                .assigningId(assigning.getId())
                .quizId(quiz != null ? quiz.getId() : null)
                .quizTitle(quiz != null ? quiz.getTitle() : null)
                .classroomId(classroom != null ? classroom.getId() : null)
                .classroomName(classroom != null ? classroom.getName() : null)
                .startDate(assigning.getStartDate())
                .dueDate(assigning.getDueDate())
                .durationInMins(assigning.getDurationInMins())
                .maxAttempt(assigning.getMaxAttempt())
                .attemptsMade(info.getAttemptsMade())
                .attemptsLeft(info.getAttemptsLeft())
                .hasStarted(info.isHasStarted())
                .hasUnfinished(info.isHasUnfinished())
                .build();
    }

    /**
     * Used where per-student attempt stats aren't computed by the source service
     * (e.g. classroom detail, which - like its legacy Thymeleaf template - only
     * shows scheduling/attempt-limit info, not attempts-made/left).
     */
    public static AssignedQuizSummaryDTO fromAssigning(QuizAssigning assigning) {
        var quiz = assigning.getQuiz();
        var classroom = assigning.getClassroom();
        return AssignedQuizSummaryDTO.builder()
                .assigningId(assigning.getId())
                .quizId(quiz != null ? quiz.getId() : null)
                .quizTitle(quiz != null ? quiz.getTitle() : null)
                .classroomId(classroom != null ? classroom.getId() : null)
                .classroomName(classroom != null ? classroom.getName() : null)
                .startDate(assigning.getStartDate())
                .dueDate(assigning.getDueDate())
                .durationInMins(assigning.getDurationInMins())
                .maxAttempt(assigning.getMaxAttempt())
                .attemptsMade(0)
                .attemptsLeft(assigning.getMaxAttempt() != null ? assigning.getMaxAttempt() : -1)
                .hasStarted(false)
                .hasUnfinished(false)
                .build();
    }
}

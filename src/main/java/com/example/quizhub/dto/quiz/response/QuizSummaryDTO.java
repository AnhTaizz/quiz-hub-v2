package com.example.quizhub.dto.quiz.response;

import java.time.LocalDateTime;
import java.util.UUID;

import com.example.quizhub.entity.Quiz;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * DTO gọn để hiển thị quiz trong danh sách category browser.
 * Không chứa danh sách câu hỏi để tránh N+1 và giảm payload.
 */
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class QuizSummaryDTO {
    UUID id;
    String title;
    String description;
    String imageUrl;
    Boolean isDraft;
    Boolean isExam;
    int questionCount;
    String creatorName;
    String categoryName;
    Long categoryId;
    String takingStatus; // NOT_STARTED, IN_PROGRESS, COMPLETED
    String attemptInfo;  // e.g. "Lần làm: 2"
    LocalDateTime createdAt;

    public QuizSummaryDTO(Quiz quiz) {
        this.id = quiz.getId();
        this.title = quiz.getTitle();
        this.description = quiz.getDescription();
        this.imageUrl = quiz.getImageUrl();
        this.isDraft = quiz.getIsDraft();
        this.isExam = quiz.getIsExam();
        this.questionCount = (quiz.getQuestions() != null) ? quiz.getQuestions().size() : 0;
        this.creatorName = (quiz.getCreator() != null) ? quiz.getCreator().getFullName() : "";
        this.categoryName = (quiz.getCategory() != null) ? quiz.getCategory().getName() : "";
        this.categoryId = (quiz.getCategory() != null) ? quiz.getCategory().getId() : null;
        this.createdAt = quiz.getCreatedAt();
    }
}

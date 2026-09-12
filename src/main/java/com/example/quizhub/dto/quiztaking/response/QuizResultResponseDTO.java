package com.example.quizhub.dto.quiztaking.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuizResultResponseDTO {
    private Long attemptId;
    private String quizTitle;
    private BigDecimal score;
    private Integer correctNum;
    private Integer incorrectNum;
    private int totalNum;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private List<QuestionResultDTO> questions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionResultDTO {
        private Long questionId;
        private String text;
        private String type;
        private String level;
        private List<AnswerResultDTO> answers;
        private List<Long> selectedAnswerIds;
        private String selectedText;
        private Boolean isCorrect;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AnswerResultDTO {
        private Long answerId;
        private String text;
        private Boolean isCorrect;
    }
}

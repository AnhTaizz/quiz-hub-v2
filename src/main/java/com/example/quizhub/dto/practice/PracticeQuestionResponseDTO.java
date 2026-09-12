package com.example.quizhub.dto.practice;

import java.util.List;

import com.example.quizhub.entity.enums.QuestionLevel;
import com.example.quizhub.entity.enums.QuestionType;

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
public class PracticeQuestionResponseDTO {
    Long id;
    String text;
    QuestionType type;
    QuestionLevel level;
    
    // Hidden answers without isCorrect
    List<PracticeAnswerResponseDTO> answers;

    List<Long> selectedAnswerIds;
    String selectedText;
    Boolean isCorrect;
}

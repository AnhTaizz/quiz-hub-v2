package com.example.quizhub.dto.quiztaking.response;

import java.util.List;

import com.example.quizhub.entity.enums.QuestionLevel;
import com.example.quizhub.entity.enums.QuestionType;

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
public class QuestionTakingResponseDTO {
    Long id;
    String text;
    QuestionType type;
    QuestionLevel level;
    List<AnswerTakingResponseDTO> answers;
}

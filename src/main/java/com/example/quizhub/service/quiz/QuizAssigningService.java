package com.example.quizhub.service.quiz;

import com.example.quizhub.dto.quizassigning.request.QuizAssigningRequestDTO;
import com.example.quizhub.dto.quizassigning.response.QuizAssigningResponseDTO;

public interface QuizAssigningService {
    QuizAssigningResponseDTO create(QuizAssigningRequestDTO requestDTO);
    void delete(Long id);
    void closeAssignment(Long id);
    void toggleHidden(Long id);
    void updateDeadline(Long id, java.time.LocalDateTime newDeadline);
}

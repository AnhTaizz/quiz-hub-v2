package com.example.quizhub.service.quiz;

import com.example.quizhub.dto.quiztaking.request.QuizSubmitRequestDTO;
import com.example.quizhub.dto.quiztaking.request.SaveAnswerRequestDTO;
import com.example.quizhub.dto.quiztaking.request.ViolationRequestDTO;
import com.example.quizhub.dto.quiztaking.response.QuizAttemptSummaryDTO;
import com.example.quizhub.dto.quiztaking.response.QuizResultResponseDTO;
import com.example.quizhub.dto.quiztaking.response.QuizTakingResponseDTO;
import com.example.quizhub.dto.quiztaking.response.ViolationResponseDTO;
import com.example.quizhub.entity.Attempt;
import java.util.List;

public interface QuizTakingService {
        QuizTakingResponseDTO startQuizAttempt(Long studentId, Long quizAssigningId);

        QuizTakingResponseDTO startPersonalQuizAttempt(Long studentId, String quizId);

        Attempt submitQuizAttempt(Long studentId, QuizSubmitRequestDTO requestDTO);

        void saveAnswer(Long studentId, Long attemptId, Long questionId,
                        SaveAnswerRequestDTO request);

        QuizResultResponseDTO getQuizResult(Long studentId, Long attemptId);

        ViolationResponseDTO recordViolation(ViolationRequestDTO request);

        void autoSubmitExpiredAttempts();

        List<QuizAttemptSummaryDTO> getQuizAttempts(Long studentId, String quizId);

        QuizTakingResponseDTO getQuizTakingState(Long studentId, Long attemptId);
}

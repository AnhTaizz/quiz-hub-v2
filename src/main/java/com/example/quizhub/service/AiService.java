package com.example.quizhub.service;

import java.util.List;

import com.example.quizhub.dto.question.AiGenerationRequestDTO;
import com.example.quizhub.dto.question.QuestionRequestDTO;

public interface AiService {

    /**
     * Gọi Google Gemini API để sinh danh sách câu hỏi trắc nghiệm
     * từ nội dung văn bản do giáo viên cung cấp.
     *
     * @param request DTO chứa văn bản, số lượng câu, độ khó, danh mục
     * @return Danh sách QuestionRequestDTO đã điền đầy đủ để giáo viên xem trước
     */
    List<QuestionRequestDTO> generateQuestions(AiGenerationRequestDTO request);
}

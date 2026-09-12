package com.example.quizhub.controller.rest;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.ApiResponse;
import com.example.quizhub.dto.question.AiGenerationRequestDTO;
import com.example.quizhub.dto.question.QuestionRequestDTO;
import com.example.quizhub.service.AiService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiRestController {

    private final AiService aiService;

    /**
     * Endpoint tạo câu hỏi bằng AI.
     * Trả về danh sách câu hỏi để Frontend render lên bảng Preview.
     * Chưa lưu vào DB — giáo viên cần xem trước rồi bấm "Lưu vào kho" riêng.
     */
    @PostMapping("/generate-questions")
    public ResponseEntity<ApiResponse<List<QuestionRequestDTO>>> generateQuestions(
            @RequestBody @Valid AiGenerationRequestDTO request) {

        List<QuestionRequestDTO> questions = aiService.generateQuestions(request);

        return ResponseEntity.ok(ApiResponse.<List<QuestionRequestDTO>>builder()
                .code(200)
                .message("Tạo câu hỏi bằng AI thành công")
                .result(questions)
                .build());
    }
}

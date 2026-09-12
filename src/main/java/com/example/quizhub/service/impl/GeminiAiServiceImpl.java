package com.example.quizhub.service.impl;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.example.quizhub.dto.ai.GeminiRequestDTO;
import com.example.quizhub.dto.ai.GeminiResponseDTO;
import com.example.quizhub.dto.question.AiGenerationRequestDTO;
import com.example.quizhub.dto.question.QuestionRequestDTO;
import com.example.quizhub.entity.enums.QuestionLevel;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.quizhub.service.AiService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiAiServiceImpl implements AiService {

    @Value("${app.ai.gemini.api-key}")
    private String apiKey;

    @Value("${app.ai.gemini.url}")
    private String apiUrl;

    private final ObjectMapper objectMapper;

    @Override
    public List<QuestionRequestDTO> generateQuestions(AiGenerationRequestDTO request) {
        String prompt = buildPrompt(request);
        log.info("[AI] Gọi Gemini API tạo {} câu hỏi, level={}", request.getNumberOfQuestions(), request.getLevel());

        GeminiRequestDTO body = GeminiRequestDTO.builder()
                .contents(List.of(
                        GeminiRequestDTO.Content.builder()
                                .parts(List.of(GeminiRequestDTO.Part.builder().text(prompt).build()))
                                .build()))
                .generationConfig(GeminiRequestDTO.GenerationConfig.builder()
                        .response_mime_type("application/json")
                        .build())
                .build();

        try {
            RestClient restClient = RestClient.create();

            GeminiResponseDTO response = restClient.post()
                    .uri(apiUrl + "?key=" + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(GeminiResponseDTO.class);

            if (response == null) {
                log.error("[AI] Gemini trả về response null");
                throw new AppException(ErrorCode.AI_GENERATION_FAILED);
            }

            String jsonText = response.extractText();
            if (jsonText == null || jsonText.isBlank()) {
                log.error("[AI] Gemini trả về text rỗng");
                throw new AppException(ErrorCode.AI_GENERATION_FAILED);
            }

            log.info("[AI] Gemini phản hồi thành công, đang parse JSON...");
            List<QuestionRequestDTO> questions = objectMapper.readValue(
                    jsonText, new TypeReference<List<QuestionRequestDTO>>() {});

            // Gán categoryId từ request vào từng câu hỏi
            questions.forEach(q -> {
                q.setCategoryId(request.getCategoryId());
                if (q.getType() == null) q.setType(QuestionType.SINGLE_CHOICE);
            });

            log.info("[AI] Parse thành công {} câu hỏi.", questions.size());
            return questions;

        } catch (AppException e) {
            throw e;
        } catch (RestClientException e) {
            log.error("[AI] Lỗi kết nối đến Gemini API: {}", e.getMessage());
            throw new AppException(ErrorCode.AI_GENERATION_FAILED);
        } catch (Exception e) {
            log.error("[AI] Lỗi parse JSON từ Gemini: {}", e.getMessage());
            throw new AppException(ErrorCode.AI_GENERATION_FAILED);
        }
    }

    private String buildPrompt(AiGenerationRequestDTO request) {
        String levelDescription = switch (request.getLevel()) {
            case EASY -> "DỄ (kiến thức cơ bản, nhận biết trực tiếp từ văn bản)";
            case MEDIUM -> "TRUNG BÌNH (hiểu và vận dụng kiến thức)";
            case HARD -> "KHÓ (đòi hỏi suy luận logic, phân tích chuyên sâu, không chỉ nhớ vẹt)";
        };

        return """
                Bạn là một giáo viên chuyên nghiệp. Hãy đọc kỹ nội dung sau và tạo ra CHÍNH XÁC %d câu hỏi trắc nghiệm bằng TIẾNG VIỆT ở mức độ %s.

                YÊU CẦU BẮT BUỘC:
                - Mỗi câu hỏi có CHÍNH XÁC 4 đáp án (A, B, C, D).
                - Trong 4 đáp án đó, có ĐÚNG 1 đáp án "isCorrect": true và 3 đáp án còn lại "isCorrect": false.
                - Vị trí của đáp án đúng ("isCorrect": true) trong mảng "answers" phải được xáo trộn ngẫu nhiên cho từng câu hỏi, KHÔNG ĐƯỢC luôn luôn để ở vị trí đầu tiên (A).
                - Câu hỏi phải bám sát nội dung bài, không bịa đặt thông tin ngoài văn bản.
                - Đáp án sai phải có tính gây nhầm lẫn cao, không quá rõ ràng.

                ĐỊNH DẠNG JSON trả về (KHÔNG được có bất kỳ text nào ngoài mảng JSON này):
                [
                  {
                    "text": "Nội dung câu hỏi?",
                    "type": "SINGLE_CHOICE",
                    "level": "%s",
                    "answers": [
                      { "text": "Đáp án sai 1", "isCorrect": false },
                      { "text": "Đáp án đúng (ngẫu nhiên ở vị trí khác nhau cho từng câu)", "isCorrect": true },
                      { "text": "Đáp án sai 2", "isCorrect": false },
                      { "text": "Đáp án sai 3", "isCorrect": false }
                    ]
                  }
                ]

                --- NỘI DUNG BÀI GIẢNG ---
                %s
                """.formatted(
                request.getNumberOfQuestions(),
                levelDescription,
                request.getLevel().name(),
                request.getText()
        );
    }
}

package com.example.quizhub.dto.ai;

import java.util.List;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * Ánh xạ cấu trúc Response trả về từ Gemini API:
 * {
 *   "candidates": [{
 *     "content": {
 *       "parts": [{ "text": "[{...câu hỏi JSON...}]" }]
 *     }
 *   }]
 * }
 */
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GeminiResponseDTO {

    List<Candidate> candidates;

    @Getter
    @Setter
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Candidate {
        Content content;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Content {
        List<Part> parts;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @FieldDefaults(level = AccessLevel.PRIVATE)
    public static class Part {
        String text;
    }

    /**
     * Tiện ích: trích xuất chuỗi JSON câu hỏi từ sâu bên trong cấu trúc lồng nhau.
     * Trả về null nếu response rỗng hoặc không hợp lệ.
     */
    public String extractText() {
        if (candidates == null || candidates.isEmpty()) return null;
        Candidate candidate = candidates.get(0);
        if (candidate.content == null) return null;
        List<Part> parts = candidate.content.parts;
        if (parts == null || parts.isEmpty()) return null;
        return parts.get(0).text;
    }
}

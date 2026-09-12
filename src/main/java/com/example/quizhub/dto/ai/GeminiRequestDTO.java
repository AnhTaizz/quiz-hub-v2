package com.example.quizhub.dto.ai;

import java.util.List;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * Cấu trúc Request Body gửi lên Gemini API:
 * {
 *   "contents": [{ "parts": [{ "text": "..." }] }],
 *   "generationConfig": { "response_mime_type": "application/json" }
 * }
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GeminiRequestDTO {

    List<Content> contents;
    GenerationConfig generationConfig;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Content {
        List<Part> parts;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Part {
        String text;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GenerationConfig {
        // Ép Gemini trả về JSON thuần, không có markdown wrapper
        String response_mime_type;
    }
}

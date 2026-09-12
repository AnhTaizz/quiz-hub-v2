package com.example.quizhub.service;

import java.util.List;
import java.util.Map;

import org.springframework.web.multipart.MultipartFile;

import com.example.quizhub.dto.question.QuestionRequestDTO;

public interface QuestionImportService {
    Map<String, Object> importQuestionsFromExcel(MultipartFile file, Long categoryId, Long teacherId);

    /** Admin import Excel → tất cả câu hỏi ra trạng thái PUBLIC ngay */
    Map<String, Object> importPublicQuestionsFromExcel(MultipartFile file, Long categoryId, Long adminId);

    Map<String, Object> parseExcelOnly(MultipartFile file);
}


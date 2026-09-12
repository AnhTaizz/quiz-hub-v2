package com.example.quizhub.service.impl;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.example.quizhub.dto.question.AnswerCreationRequestDTO;
import com.example.quizhub.dto.question.QuestionRequestDTO;
import com.example.quizhub.dto.question.QuestionResponseDTO;
import com.example.quizhub.entity.enums.QuestionLevel;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.service.QuestionImportService;
import com.example.quizhub.service.QuestionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuestionImportServiceImpl implements QuestionImportService {

    private final QuestionService questionService;

    @Override
    public Map<String, Object> parseExcelOnly(MultipartFile file) {
        List<QuestionRequestDTO> list = new ArrayList<>();
        int successCount = 0;
        int errorCount = 0;
        List<String> errors = new ArrayList<>();

        try (InputStream is = file.getInputStream();
            Workbook workbook = new XSSFWorkbook(is)) {
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;
                try {
                    QuestionRequestDTO dto = mapRowToDTO(row, formatter);
                    list.add(dto);
                    successCount++;
                } catch (Exception e) {
                    errorCount++;
                    log.warn("Bỏ qua dòng {} trong file review do lỗi: {}", i + 1, e.getMessage());
                    errors.add("Dòng " + (i + 1) + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("successCount", successCount);
        response.put("errorCount", errorCount);
        response.put("errors", errors);
        response.put("data", list);

        return response;
    }

    private QuestionRequestDTO mapRowToDTO(Row row, DataFormatter formatter) {
        // Column 0: Nội dung câu hỏi
        String text = getCellValue(row, 0, formatter).trim();
        if (text.isEmpty()) {
            throw new RuntimeException("Nội dung câu hỏi không được để trống (Cột A)");
        }

        // Column 1: Loại câu hỏi
        String typeRaw = getCellValue(row, 1, formatter).trim().toLowerCase();
        QuestionType type = mapType(typeRaw);

        // Column 2: Mức độ
        String levelRaw = getCellValue(row, 2, formatter).trim().toLowerCase();
        QuestionLevel level = mapLevel(levelRaw);

        // Columns 3 -> 10: Đáp án A -> H
        List<String> rawAnswers = new ArrayList<>();
        boolean foundEmpty = false;
        for (int col = 3; col <= 10; col++) {
            String val = getCellValue(row, col, formatter).trim();
            if (!val.isEmpty()) {
                if (foundEmpty) {
                    throw new RuntimeException("Các phương án đáp án (Từ cột D đến K) phải được điền liên tục, không để khoảng trống ở giữa.");
                }
                rawAnswers.add(val);
            } else {
                foundEmpty = true;
            }
        }

        if (rawAnswers.isEmpty()) {
            throw new RuntimeException("Phải có ít nhất 1 phương án đáp án (Từ cột D đến K)");
        }

        if (type != QuestionType.FILL_IN_BLANK && rawAnswers.size() < 2) {
            throw new RuntimeException("Câu hỏi trắc nghiệm phải có ít nhất 2 phương án đáp án.");
        }

        // Column 11: Đáp án đúng
        String correctStr = getCellValue(row, 11, formatter).trim().toUpperCase();
        Set<Integer> correctIndices = parseCorrectIndices(correctStr, type, rawAnswers.size());

        // Build AnswerDTOs
        List<AnswerCreationRequestDTO> answerDTOs = new ArrayList<>();
        int correctCount = 0;
        for (int j = 0; j < rawAnswers.size(); j++) {
            boolean isCorrect = (type == QuestionType.FILL_IN_BLANK) || correctIndices.contains(j);
            if (isCorrect) correctCount++;
            answerDTOs.add(AnswerCreationRequestDTO.builder()
                    .text(rawAnswers.get(j))
                    .correct(isCorrect)
                    .build());
        }

        if (type == QuestionType.SINGLE_CHOICE && correctCount != 1) {
            throw new RuntimeException("Câu trắc nghiệm 1 đáp án phải khai báo chính xác 1 đáp án đúng (Cột L)");
        }
        if (type == QuestionType.MULTIPLE_CHOICE && correctCount == 0) {
            throw new RuntimeException("Câu chọn nhiều đáp án phải có ít nhất 1 đáp án đúng (Cột L)");
        }

        // Return DTO shell
        return QuestionRequestDTO.builder()
                .text(text)
                .type(type)
                .level(level)
                .answers(answerDTOs)
                .build();
    }

    @Override
    public Map<String, Object> importQuestionsFromExcel(MultipartFile file, Long categoryId, Long teacherId) {
        int successCount = 0;
        int errorCount = 0;
        List<String> errors = new ArrayList<>();
        List<QuestionResponseDTO> importedList = new ArrayList<>();

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();

            for (int i = 1; i <= sheet.getLastRowNum(); i++) { // Bỏ qua row 0 (tiêu đề)
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;

                try {
                    QuestionRequestDTO dto = mapRowToDTO(row, formatter);
                    dto.setCategoryId(categoryId);

                    QuestionResponseDTO saved = questionService.createNewQuestion(teacherId, dto);
                    successCount++;
                    importedList.add(saved);

                } catch (Exception ex) {
                    errorCount++;
                    log.error("Lỗi khi đọc dòng {}: {}", i + 1, ex.getMessage());
                    errors.add("Dòng " + (i + 1) + ": " + ex.getMessage());
                }
            }

        } catch (Exception e) {
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("successCount", successCount);
        response.put("errorCount", errorCount);
        response.put("errors", errors);
        response.put("importedQuestions", importedList);
        return response;
    }

    @Override
    public Map<String, Object> importPublicQuestionsFromExcel(MultipartFile file, Long categoryId, Long adminId) {
        int successCount = 0;
        int errorCount = 0;
        List<String> errors = new ArrayList<>();
        List<QuestionResponseDTO> importedList = new ArrayList<>();

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;

                try {
                    QuestionRequestDTO dto = mapRowToDTO(row, formatter);
                    dto.setCategoryId(categoryId);

                    // Admin: câu hỏi PUBLIC ngay, không cần duyệt
                    QuestionResponseDTO saved = questionService.createPublicQuestionByAdmin(adminId, dto);
                    successCount++;
                    importedList.add(saved);

                } catch (Exception ex) {
                    errorCount++;
                    log.error("Admin import lỗi dòng {}: {}", i + 1, ex.getMessage());
                    errors.add("Dòng " + (i + 1) + ": " + ex.getMessage());
                }
            }

        } catch (Exception e) {
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("successCount", successCount);
        response.put("errorCount", errorCount);
        response.put("errors", errors);
        response.put("importedQuestions", importedList);
        return response;
    }

    private boolean isRowEmpty(Row row) {
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) return false;
        }
        return true;
    }

    private String getCellValue(Row row, int cellIndex, DataFormatter formatter) {
        Cell cell = row.getCell(cellIndex);
        if (cell == null) return "";
        return formatter.formatCellValue(cell);
    }

    private QuestionType mapType(String raw) {
        if (raw.contains("nhiều") || raw.contains("multiple")) return QuestionType.MULTIPLE_CHOICE;
        if (raw.contains("khuyết") || raw.contains("fill")) return QuestionType.FILL_IN_BLANK;
        return QuestionType.SINGLE_CHOICE; // Mặc định là trắc nghiệm 1
    }

    private QuestionLevel mapLevel(String raw) {
        if (raw.contains("dễ") || raw.contains("easy")) return QuestionLevel.EASY;
        if (raw.contains("khó") || raw.contains("hard")) return QuestionLevel.HARD;
        return QuestionLevel.MEDIUM; // Mặc định là Trung bình
    }

    private Set<Integer> parseCorrectIndices(String raw, QuestionType type, int answerCount) {
        Set<Integer> result = new HashSet<>();
        if (type == QuestionType.FILL_IN_BLANK) return result; // Xử lý riêng sau

        String clean = raw.replaceAll("[^A-Ha-h,;]", "").toUpperCase(); // Lọc các ký tự A-H, a-h và dấu phẩy
        if (clean.isEmpty() && !raw.trim().isEmpty()) {
            throw new RuntimeException("Đáp án đúng (Cột L) chứa ký tự không hợp lệ. Chỉ chấp nhận các chữ cái từ A đến H.");
        }

        String[] tokens = clean.split("[,;]");

        for (String t : tokens) {
            t = t.trim();
            if (t.isEmpty()) continue;
            char c = t.charAt(0);
            int index = c - 'A';
            if (index < 0 || index >= answerCount) {
                throw new RuntimeException("Đáp án đúng '" + c + "' trỏ đến phương án không tồn tại (Bạn chỉ nhập " + answerCount + " phương án).");
            }
            result.add(index);
        }
        return result;
    }
}

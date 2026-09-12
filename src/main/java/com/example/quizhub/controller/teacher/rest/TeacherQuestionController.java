// src/main/java/com/example/quizhub/controller/teacher/rest/TeacherQuestionController.java
package com.example.quizhub.controller.teacher.rest;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import com.example.quizhub.dto.question.QuestionRequestDTO;
import com.example.quizhub.dto.question.QuestionResponseDTO;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.service.QuestionImportService;
import com.example.quizhub.service.QuestionService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/teacher/questions")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
public class TeacherQuestionController {

    private final QuestionService questionService;
    private final UserRepository userRepository;
    private final QuestionImportService questionImportService;
    private final com.example.quizhub.service.CategoryService categoryService;

    private Long getCurrentUserId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return user.getId();
    }

    @PostMapping("/import")
    public ResponseEntity<Map<String, Object>> importQuestions(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) Long categoryId) {
        Map<String, Object> result = questionImportService.importQuestionsFromExcel(file, categoryId,
                getCurrentUserId());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/parse-only")
    public ResponseEntity<Map<String, Object>> parseQuestionsOnly(
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(questionImportService.parseExcelOnly(file));
    }

    @PostMapping
    public ResponseEntity<QuestionResponseDTO> createQuestion(@RequestBody @Valid QuestionRequestDTO request) {
        QuestionResponseDTO response = questionService.createNewQuestion(getCurrentUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ĐÃ SỬA: Thêm isPublicTab và rẽ nhánh gọi Service
    @GetMapping
    public ResponseEntity<Page<QuestionResponseDTO>> getQuestionsByTeacher(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) QuestionType type,
            @RequestParam(required = false) com.example.quizhub.entity.enums.QuestionLevel level,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "false") Boolean isPublicTab,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        Page<QuestionResponseDTO> response;

        if (isPublicTab) {
            // Lấy kho hệ thống
            response = questionService.searchPublicQuestion(categoryId, type, level, keyword, page, size, sortBy,
                    sortDir);
        } else {
            // Lấy kho cá nhân
            response = questionService.searchMyQuestion(getCurrentUserId(), categoryId, type, level, keyword, page,
                    size, sortBy, sortDir);
        }

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<QuestionResponseDTO> getQuestionById(@PathVariable Long id) {
        return ResponseEntity.ok(questionService.getQuestionById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<QuestionResponseDTO> updateQuestion(
            @PathVariable Long id,
            @RequestBody @Valid QuestionRequestDTO request) {
        return ResponseEntity.ok(questionService.updateQuestion(getCurrentUserId(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteQuestion(@PathVariable Long id) {
        questionService.deleteQuestion(getCurrentUserId(), id);
        return ResponseEntity.noContent().build();
    }

    // MỚI THÊM: API xin chia sẻ (Xin Public)
    // MỚI THÊM: API xin chia sẻ (Xin Public)
    @PutMapping("/{id}/share")
    public ResponseEntity<String> requestShareQuestion(@PathVariable Long id) {
        questionService.requestShareQuestion(id, getCurrentUserId());
        return ResponseEntity.ok("Question has been submitted for approval");
    }

    @PutMapping("/bulk-share")
    public ResponseEntity<String> bulkRequestShareQuestions(@RequestBody java.util.List<Long> ids) {
        questionService.bulkRequestShareQuestions(ids, getCurrentUserId());
        return ResponseEntity.ok("Questions have been submitted for approval");
    }

    @PutMapping("/bulk-share-all")
    public ResponseEntity<String> bulkRequestShareAllQuestions(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) QuestionType type,
            @RequestParam(required = false) String keyword) {
        questionService.bulkRequestShareAllQuestions(getCurrentUserId(), categoryId, type, keyword);
        return ResponseEntity.ok("All matching questions have been submitted for approval");
    }

    @DeleteMapping("/bulk-delete")
    public ResponseEntity<String> bulkDeleteQuestions(@RequestBody java.util.List<Long> ids) {
        questionService.bulkDeleteQuestions(ids, getCurrentUserId());
        return ResponseEntity.ok("Questions have been successfully deleted");
    }

    /**
     * Lấy danh sách câu hỏi hợp lệ theo danh mục để sinh đề ngẫu nhiên.
     * Trả về cả câu hỏi PUBLIC và câu hỏi của chính teacher (không bị DELETED).
     */
    @GetMapping("/for-generation")
    public ResponseEntity<java.util.List<QuestionResponseDTO>> getQuestionsForGeneration(
            @RequestParam Long categoryId,
            @RequestParam(required = false, defaultValue = "10") int amount) {
        Long userId = getCurrentUserId();
        List<Long> categoryIds = categoryService.getAllDescendantIds(categoryId);
        if (categoryId != null && categoryId == -1L) {
            categoryIds.add(-1L);
        }
        List<Long> ids = questionService.getValidQuestionIdsForGeneration(
                categoryIds, userId);

        if (ids == null || ids.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        Collections.shuffle(ids);
        List<Long> selectedIds = ids.stream()
                .limit(amount)
                .collect(Collectors.toList());

        List<QuestionResponseDTO> result = questionService.getQuestionsByIds(selectedIds);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/bulk-delete-all")
    public ResponseEntity<String> bulkDeleteAllQuestions(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) QuestionType type,
            @RequestParam(required = false) String keyword) {
        questionService.bulkDeleteAllQuestions(getCurrentUserId(), categoryId, type, keyword);
        return ResponseEntity.ok("All matching questions have been successfully deleted");
    }
}

package com.example.quizhub.controller.student.rest;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.category.CategoryRequestDTO;
import com.example.quizhub.dto.category.CategoryResponseDTO;
import com.example.quizhub.dto.quiz.response.QuizSummaryDTO;
import com.example.quizhub.service.CategoryService;
import com.example.quizhub.service.quiz.QuizService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * REST API dành cho học sinh:
 *   GET  /api/categories/public              → danh mục công khai
 *   GET  /api/categories/mine               → danh mục cá nhân
 *   POST /api/categories                    → tạo danh mục mới
 *   PUT  /api/categories/{id}               → cập nhật danh mục
 *   DELETE /api/categories/{id}             → xóa danh mục
 *   GET  /api/categories/{id}/quizzes/public → quiz công khai
 *   GET  /api/categories/{id}/quizzes/mine  → quiz cá nhân
 */
@RestController
@RequestMapping("/api/student/categories")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentCategoryRestController {

    private final CategoryService categoryService;
    private final QuizService quizService;

    @GetMapping("/public")
    public ResponseEntity<List<CategoryResponseDTO>> getPublicCategories() {
        return ResponseEntity.ok(categoryService.getPublicCategories());
    }

    @GetMapping("/mine")
    public ResponseEntity<List<CategoryResponseDTO>> getMyCategories() {
        return ResponseEntity.ok(categoryService.getMyCategories());
    }

    @PostMapping
    public ResponseEntity<CategoryResponseDTO> createCategory(@RequestBody @Valid CategoryRequestDTO request) {
        request.setIsPublic(false); // Sinh viên không được phép tạo danh mục công khai
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryService.createCategory(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CategoryResponseDTO> updateCategory(
            @PathVariable Long id, @RequestBody @Valid CategoryRequestDTO request) {
        request.setIsPublic(false); // Sinh viên không được phép đổi danh mục thành công khai
        return ResponseEntity.ok(categoryService.updateCategory(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/quizzes/public")
    public ResponseEntity<List<QuizSummaryDTO>> getPublicQuizzes(@PathVariable Long id) {
        return ResponseEntity.ok(quizService.getPublicQuizzesByCategoryId(id));
    }

    @GetMapping("/{id}/quizzes/mine")
    public ResponseEntity<List<QuizSummaryDTO>> getMyQuizzes(@PathVariable Long id) {
        return ResponseEntity.ok(quizService.getMyQuizzesByCategoryId(id));
    }
}

package com.example.quizhub.controller.admin.rest;

import java.util.List;

import org.springframework.data.domain.Page;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.category.CategoryRequestDTO;
import com.example.quizhub.dto.category.CategoryResponseDTO;
import com.example.quizhub.dto.question.QuestionResponseDTO;
import com.example.quizhub.dto.quiz.response.QuizSummaryDTO;
import com.example.quizhub.entity.enums.QuestionLevel;
import com.example.quizhub.entity.enums.QuestionStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.service.CategoryService;
import com.example.quizhub.service.QuestionService;
import com.example.quizhub.service.quiz.QuizService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/categories")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminCategoryRestController {

    private final CategoryService categoryService;
    private final QuizService quizService;
    private final QuestionService questionService;

    @GetMapping
    public ResponseEntity<List<CategoryResponseDTO>> getPublicCategories() {
        // Trả về toàn bộ danh mục public cho admin quản lý
        return ResponseEntity.ok(categoryService.getPublicCategories());
    }

    @GetMapping("/all-flat")
    public ResponseEntity<List<CategoryResponseDTO>> getAllCategoriesFlat() {
        return ResponseEntity.ok(categoryService.getAllCategoriesFlat());
    }

    @PostMapping
    public ResponseEntity<CategoryResponseDTO> createCategory(@RequestBody @Valid CategoryRequestDTO request) {
        request.setIsPublic(true); // Ép kiểu luôn tạo danh mục công khai
        CategoryResponseDTO response = categoryService.createCategory(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CategoryResponseDTO> getCategoryById(@PathVariable Long id) {
        return ResponseEntity.ok(categoryService.getCategoryById(id));
    }

    @GetMapping("/{id}/quizzes")
    public ResponseEntity<List<QuizSummaryDTO>> getPublicQuizzes(@PathVariable Long id) {
        return ResponseEntity.ok(quizService.getPublicQuizzesByCategoryId(id));
    }

    @GetMapping("/{id}/questions")
    public ResponseEntity<Page<QuestionResponseDTO>> getQuestionsByCategoryId(
            @PathVariable Long id,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) QuestionType type,
            @RequestParam(required = false) QuestionLevel level,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        return ResponseEntity.ok(questionService.searchQuestions(
                QuestionStatus.PUBLIC, id, type, level, keyword, null, page, size, sortBy, sortDir));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CategoryResponseDTO> updateCategory(
            @PathVariable Long id,
            @RequestBody @Valid CategoryRequestDTO request) {
        request.setIsPublic(true); // Luôn là danh mục công khai
        return ResponseEntity.ok(categoryService.updateCategory(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }
}

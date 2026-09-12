package com.example.quizhub.controller.teacher.rest;

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

@RestController
@RequestMapping("/api/teacher/categories")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
public class TeacherCategoryController {

    private final CategoryService categoryService;
    private final QuizService quizService;

    @GetMapping
    public ResponseEntity<List<CategoryResponseDTO>> getAllCategories() {
        return ResponseEntity.ok(categoryService.getAllCategories());
    }

    /** Danh mục công khai (isPublic=true) kèm số quiz */
    @GetMapping("/public")
    public ResponseEntity<List<CategoryResponseDTO>> getPublicCategories() {
        return ResponseEntity.ok(categoryService.getPublicCategories());
    }

    /** Danh mục cá nhân của giáo viên đang đăng nhập */
    @GetMapping("/mine")
    public ResponseEntity<List<CategoryResponseDTO>> getMyCategories() {
        return ResponseEntity.ok(categoryService.getMyCategories());
    }

    @PostMapping
    public ResponseEntity<CategoryResponseDTO> createCategory(@RequestBody @Valid CategoryRequestDTO request) {
        request.setIsPublic(false); // Teacher không được phép tạo danh mục public
        CategoryResponseDTO response = categoryService.createCategory(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CategoryResponseDTO> getCategoryById(@PathVariable Long id) {
        return ResponseEntity.ok(categoryService.getCategoryById(id));
    }

    /** Quiz công khai (published) trong danh mục */
    @GetMapping("/{id}/quizzes/public")
    public ResponseEntity<List<QuizSummaryDTO>> getPublicQuizzes(@PathVariable Long id) {
        return ResponseEntity.ok(quizService.getPublicQuizzesByCategoryId(id));
    }

    /** Quiz cá nhân của giáo viên trong danh mục */
    @GetMapping("/{id}/quizzes/mine")
    public ResponseEntity<List<QuizSummaryDTO>> getMyQuizzes(@PathVariable Long id) {
        return ResponseEntity.ok(quizService.getMyQuizzesByCategoryId(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CategoryResponseDTO> updateCategory(
            @PathVariable Long id,
            @RequestBody @Valid CategoryRequestDTO request) {
        request.setIsPublic(false); // Teacher không được phép đổi danh mục thành public
        return ResponseEntity.ok(categoryService.updateCategory(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }
}

package com.example.quizhub.service;

import java.util.List;

import com.example.quizhub.dto.category.CategoryRequestDTO;
import com.example.quizhub.dto.category.CategoryResponseDTO;

public interface CategoryService {
    /** Trả về cây danh mục (tất cả) */
    List<CategoryResponseDTO> getAllCategories();

    /** Danh mục công khai (isPublic=true), kèm quizCount */
    List<CategoryResponseDTO> getPublicCategories();

    /** Danh mục cá nhân của người đang đăng nhập, kèm quizCount */
    List<CategoryResponseDTO> getMyCategories();

    CategoryResponseDTO getCategoryById(Long id);

    CategoryResponseDTO createCategory(CategoryRequestDTO request);

    CategoryResponseDTO updateCategory(Long id, CategoryRequestDTO request);

    void deleteCategory(Long id);

    List<Long> getAllDescendantIds(Long categoryId);

    /**
     * Trả về danh sách flat tất cả danh mục (kể cả private/teacher) với fullPath
     * để hiển thị trong dropdown filter. Dùng ID làm key, tránh nhầm lẫn trùng tên.
     */
    List<CategoryResponseDTO> getAllCategoriesFlat();
}


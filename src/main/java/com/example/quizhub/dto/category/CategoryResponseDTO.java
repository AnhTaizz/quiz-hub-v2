package com.example.quizhub.dto.category;

import java.util.ArrayList;
import java.util.List;

import com.example.quizhub.entity.Category;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CategoryResponseDTO {
    Long id;
    String name;
    String description;
    Long parentId;
    String parentName;  // Tên danh mục cha (để xây fullPath ở frontend)
    String fullPath;    // Đường dẫn đầy đủ: "Môn học > Chương 1" (dùng cho filter dropdown)
    String creatorName; // Tên giáo viên tạo danh mục
    String creatorRole; // Vai trò của người tạo danh mục
    int depth;          // Độ sâu trong cây (0 = gốc, 1 = con, 2 = cháu, ...)
    List<CategoryResponseDTO> children;
    Boolean isPublic;
    Boolean isOwner;
    long quizCount;   // số quiz trong danh mục (public hoặc personal tuỳ context)

    // Constructor từ entity — dùng trong getAllCategories (xây cây thủ công)
    public CategoryResponseDTO(Category category) {
        this.id = category.getId();
        this.name = category.getName();
        this.description = category.getDescription();
        this.isPublic = category.getIsPublic();
        this.parentId = (category.getParent() != null) ? category.getParent().getId() : null;
        this.isOwner = false; // được set bởi service nếu cần
        this.children = new ArrayList<>();
        this.quizCount = 0;
        this.creatorName = (category.getCreator() != null) ? category.getCreator().getFullName() : "Hệ thống";
        this.creatorRole = (category.getCreator() != null && category.getCreator().getRole() != null) ? category.getCreator().getRole().name() : "SYSTEM";
    }
}

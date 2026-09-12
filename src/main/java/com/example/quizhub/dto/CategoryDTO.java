package com.example.quizhub.dto;

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
public class CategoryDTO {
    Long id;
    String name;
    String description;
    Long parentId;
    List<CategoryDTO> children;

    public CategoryDTO(Category category) {
        this.id = category.getId();
        this.name = category.getName();
        this.description = category.getDescription();
        this.parentId = (category.getParent() != null) ? category.getParent().getId() : null;
        this.children = new ArrayList<>();
    }
}

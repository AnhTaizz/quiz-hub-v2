package com.example.quizhub.dto.category;

import jakarta.validation.constraints.NotBlank;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CategoryRequestDTO {

    @NotBlank(message = "Tên danh mục không được để trống")
    String name;

    String description;

    // null = root category
    Long parentId;

    // true = danh mục công khai
    Boolean isPublic;
}

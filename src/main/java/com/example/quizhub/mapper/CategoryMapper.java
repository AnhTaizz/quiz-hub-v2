package com.example.quizhub.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.example.quizhub.dto.category.CategoryRequestDTO;
import com.example.quizhub.dto.category.CategoryResponseDTO;
import com.example.quizhub.entity.Category;

@Mapper(componentModel = "spring")
public interface CategoryMapper {

    // Category entity -> CategoryResponseDTO (map đơn lẻ, không xây cây children)
    @Mapping(source = "parent.id", target = "parentId")
    @Mapping(target = "children",  ignore = true)
    @Mapping(target = "isOwner",   ignore = true)
    @Mapping(target = "quizCount", ignore = true)
    CategoryResponseDTO toResponseDTO(Category category);

    // CategoryRequestDTO -> Category (bỏ qua parent/children/creator vì service tự set)
    @Mapping(target = "id",       ignore = true)
    @Mapping(target = "parent",   ignore = true)
    @Mapping(target = "children", ignore = true)
    @Mapping(target = "creator",  ignore = true)
    Category toEntity(CategoryRequestDTO request);
}

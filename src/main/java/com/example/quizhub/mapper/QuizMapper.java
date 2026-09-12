package com.example.quizhub.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.example.quizhub.dto.quiz.request.QuizRequestDTO;
import com.example.quizhub.dto.quiz.response.QuizResponseDTO;
import com.example.quizhub.entity.Quiz;

@Mapper(componentModel = "spring", uses = {QuestionMapper.class})
public interface QuizMapper {

    // Quiz -> QuizResponseDTO
    @Mapping(source = "category.name", target = "categoryName")
    @Mapping(source = "category.id",   target = "categoryId")
    QuizResponseDTO toResponseDTO(Quiz quiz);

    // QuizRequestDTO -> Quiz
    // isEnable không có trong request nên bỏ qua, không map
    @Mapping(target = "id",        ignore = true)
    @Mapping(target = "creator",   ignore = true)
    @Mapping(target = "category",  ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "isEnable",  ignore = true)
    @Mapping(target = "questions", ignore = true)
    Quiz toEntity(QuizRequestDTO request);
}

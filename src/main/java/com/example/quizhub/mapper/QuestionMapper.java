package com.example.quizhub.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.example.quizhub.dto.question.AnswerResponseDTO;
import com.example.quizhub.dto.question.QuestionResponseDTO;
import com.example.quizhub.entity.Answer;
import com.example.quizhub.entity.Category;
import com.example.quizhub.entity.Question;

@Mapper(componentModel = "spring")
public interface QuestionMapper {

    // Answer -> AnswerResponseDTO (các field trùng tên, MapStruct tự map)
    AnswerResponseDTO toResponseDTO(Answer answer);

    // Question -> QuestionResponseDTO
    @Mapping(source = "creator.id", target = "creatorId")
    @Mapping(source = "creator.email", target = "creatorEmail")
    @Mapping(source = "creator.fullName", target = "creatorName")
    @Mapping(source = "category.id", target = "categoryId")
    @Mapping(target = "categoryName", expression = "java(buildCategoryPath(question.getCategory()))")
    @Mapping(source = "questionStatus", target = "questionStatus")
    QuestionResponseDTO toResponseDTO(Question question);

    default String buildCategoryPath(Category category) {
        if (category == null)
            return null;
        java.util.List<String> path = new java.util.ArrayList<>();
        Category current = category;
        while (current != null) {
            path.add(0, current.getName());
            current = current.getParent();
        }
        return String.join(" > ", path);
    }

    // List<Question> -> List<QuestionResponseDTO>
    List<QuestionResponseDTO> toResponseList(List<Question> questions);
}

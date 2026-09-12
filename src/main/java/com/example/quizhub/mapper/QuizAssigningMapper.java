package com.example.quizhub.mapper;

import com.example.quizhub.dto.quizassigning.request.QuizAssigningRequestDTO;
import com.example.quizhub.dto.quizassigning.response.QuizAssigningResponseDTO;
import com.example.quizhub.entity.QuizAssigning;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface QuizAssigningMapper {

    @Mapping(source = "classroom.id", target = "classroomId")
    @Mapping(source = "classroom.name", target = "classroomName")
    @Mapping(source = "quiz.id", target = "quizId")
    @Mapping(source = "quiz.title", target = "quizTitle")
    @Mapping(source = "topic.id", target = "topicId")
    @Mapping(source = "topic.name", target = "topicName")
    @Mapping(source = "questionShuffled", target = "questionShuffle")
    @Mapping(source = "answerShuffled", target = "answerShuffle")
    QuizAssigningResponseDTO toResponseDTO(QuizAssigning quizAssigning);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "classroom", ignore = true) // Sẽ set tay trong service
    @Mapping(target = "quiz", ignore = true)      // Sẽ set tay trong service
    @Mapping(target = "topic", ignore = true)     // Sẽ set tay trong service
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "isDeleted", ignore = true)
    QuizAssigning toEntity(QuizAssigningRequestDTO requestDTO);
}

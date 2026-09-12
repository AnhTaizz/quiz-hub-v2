package com.example.quizhub.dto.classroom.response;

import com.example.quizhub.entity.ClassTopic;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ClassTopicResponseDTO {
    private Long id;
    private String name;
    private Long classroomId;

    public static ClassTopicResponseDTO fromEntity(ClassTopic topic) {
        return new ClassTopicResponseDTO(
            topic.getId(),
            topic.getName(),
            topic.getClassroom().getId()
        );
    }
}

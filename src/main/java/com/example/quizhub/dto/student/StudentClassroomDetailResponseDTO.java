package com.example.quizhub.dto.student;

import java.util.List;

import com.example.quizhub.dto.classroom.response.ClassTopicResponseDTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentClassroomDetailResponseDTO {
    private Long id;
    private String code;
    private String name;
    private String description;
    private String imageUrl;
    private String teacherName;
    private List<ClassTopicResponseDTO> topics;
    private List<AssignedQuizSummaryDTO> assignedQuizzes;
}

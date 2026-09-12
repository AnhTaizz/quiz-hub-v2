package com.example.quizhub.service.classroom;

import java.util.List;

import com.example.quizhub.dto.classroom.request.ClassTopicRequestDTO;
import com.example.quizhub.dto.classroom.response.ClassTopicResponseDTO;

public interface ClassTopicService {
    ClassTopicResponseDTO createTopic(ClassTopicRequestDTO request, String userEmail);
    ClassTopicResponseDTO updateTopic(Long id, ClassTopicRequestDTO request, String userEmail);
    void deleteTopic(Long id, String userEmail);
    List<ClassTopicResponseDTO> getTopicsByClassroom(Long classroomId, String userEmail);
}

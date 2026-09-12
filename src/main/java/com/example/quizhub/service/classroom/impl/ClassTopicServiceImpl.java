package com.example.quizhub.service.classroom.impl;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.quizhub.dto.classroom.request.ClassTopicRequestDTO;
import com.example.quizhub.dto.classroom.response.ClassTopicResponseDTO;
import com.example.quizhub.entity.ClassTopic;
import com.example.quizhub.entity.Classroom;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.ClassTopicRepository;
import com.example.quizhub.repository.ClassroomRepository;
import com.example.quizhub.service.NotificationService;
import com.example.quizhub.service.classroom.ClassTopicService;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.NotificationType;
import com.example.quizhub.repository.ClassJoiningRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ClassTopicServiceImpl implements ClassTopicService {

    private final ClassTopicRepository classTopicRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassJoiningRepository classJoiningRepository;
    private final NotificationService notificationService;

    @Override
    @Transactional
    public ClassTopicResponseDTO createTopic(ClassTopicRequestDTO request, String userEmail) {
        Classroom classroom = classroomRepository.findById(request.getClassroomId())
                .orElseThrow(() -> new AppException(ErrorCode.CLASSROOM_NOT_FOUND));

        if (!classroom.getCreator().getEmail().equals(userEmail)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        ClassTopic topic = new ClassTopic();
        topic.setName(request.getName());
        topic.setClassroom(classroom);

        ClassTopic savedTopic = classTopicRepository.save(topic);

        // Notify students
        try {
            classJoiningRepository.findByClassroomIdAndStatus(classroom.getId(), JoinStatus.APPROVED)
                    .forEach(joining -> {
                        notificationService.createNotification(
                                joining.getLearner().getId(),
                                "Chủ đề mới: " + savedTopic.getName(),
                                "Giáo viên vừa tạo một chủ đề mới trong lớp " + classroom.getName(),
                                NotificationType.SYSTEM_ALERT, // Hoặc dùng icon phù hợp
                                "/student/classrooms");
                    });
        } catch (Exception e) {
        }

        return ClassTopicResponseDTO.fromEntity(savedTopic);
    }

    @Override
    @Transactional
    public ClassTopicResponseDTO updateTopic(Long id, ClassTopicRequestDTO request, String userEmail) {
        ClassTopic topic = classTopicRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CLASS_TOPIC_NOT_FOUND));

        if (!topic.getClassroom().getCreator().getEmail().equals(userEmail)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        topic.setName(request.getName());
        return ClassTopicResponseDTO.fromEntity(classTopicRepository.save(topic));
    }

    @Override
    @Transactional
    public void deleteTopic(Long id, String userEmail) {
        ClassTopic topic = classTopicRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.CLASS_TOPIC_NOT_FOUND));

        if (!topic.getClassroom().getCreator().getEmail().equals(userEmail)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        classTopicRepository.deleteById(id);
    }

    @Override
    public List<ClassTopicResponseDTO> getTopicsByClassroom(Long classroomId, String userEmail) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new AppException(ErrorCode.CLASSROOM_NOT_FOUND));

        return classTopicRepository.findByClassroomId(classroomId).stream()
                .map(ClassTopicResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }
}

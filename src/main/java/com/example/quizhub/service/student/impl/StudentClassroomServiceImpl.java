package com.example.quizhub.service.student.impl;

import com.example.quizhub.entity.ClassJoining;
import com.example.quizhub.entity.ClassTopic;
import com.example.quizhub.entity.Classroom;
import com.example.quizhub.entity.QuizAssigning;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.repository.ClassJoiningRepository;
import com.example.quizhub.repository.ClassTopicRepository;
import com.example.quizhub.repository.ClassroomRepository;
import com.example.quizhub.repository.QuizAssigningRepository;
import com.example.quizhub.service.student.StudentClassroomService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentClassroomServiceImpl implements StudentClassroomService {

    private final ClassJoiningRepository classJoiningRepository;
    private final ClassroomRepository classroomRepository;
    private final QuizAssigningRepository quizAssigningRepository;
    private final ClassTopicRepository classTopicRepository;

    @Override
    public List<ClassJoining> getJoinedClassrooms(Long studentId) {
        List<JoinStatus> allowedStatuses = List.of(JoinStatus.PENDING, JoinStatus.APPROVED);
        return classJoiningRepository.findByLearnerIdAndStatusIn(studentId, allowedStatuses)
                .stream()
                .filter(j -> j.getClassroom() != null)
                .collect(Collectors.toList());
    }

    @Override
    public ClassJoining getJoiningStatus(Long classroomId, Long studentId) {
        return classJoiningRepository.findByClassroomIdAndLearnerId(classroomId, studentId).orElse(null);
    }

    @Override
    public Classroom getClassroomById(Long classroomId) {
        return classroomRepository.findById(classroomId)
                .orElseThrow(() -> new RuntimeException("Classroom not found"));
    }

    @Override
    public List<QuizAssigning> getAssignedQuizzesForClassroom(Long classroomId, Long studentId) {
        return quizAssigningRepository.findByClassroomId(classroomId)
                .stream()
                .filter(a -> !Boolean.TRUE.equals(a.getIsHidden()))
                .filter(a -> {
                    String ids = a.getAssignedStudentIds();
                    if (ids == null || ids.isBlank())
                        return true;
                    return Arrays.asList(ids.split(",")).contains(String.valueOf(studentId));
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<ClassTopic> getClassTopics(Long classroomId) {
        return classTopicRepository.findByClassroomId(classroomId);
    }
}

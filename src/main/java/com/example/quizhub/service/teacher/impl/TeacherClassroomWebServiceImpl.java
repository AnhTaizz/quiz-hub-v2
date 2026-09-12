package com.example.quizhub.service.teacher.impl;

import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.teacher.TeacherClassroomWebService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeacherClassroomWebServiceImpl implements TeacherClassroomWebService {

    private final ClassroomRepository classroomRepository;
    private final ClassJoiningRepository classJoiningRepository;
    private final QuizAssigningRepository quizAssigningRepository;
    private final QuizRepository quizRepository;
    private final ClassTopicRepository classTopicRepository;
    private final CategoryRepository categoryRepository;

    @Override
    public List<Classroom> getTeacherClassrooms(Long teacherId) {
        return classroomRepository.findByCreatorId(teacherId);
    }

    @Override
    public Map<Long, Long> getActiveMemberCounts(List<Classroom> classrooms) {
        return classrooms.stream()
                .collect(Collectors.toMap(
                        Classroom::getId,
                        c -> classJoiningRepository.countByClassroomIdAndStatus(c.getId(), JoinStatus.APPROVED)
                ));
    }

    @Override
    public Classroom getClassroomByIdAndTeacher(Long classroomId, Long teacherId) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new RuntimeException("Classroom not found"));
        if (!classroom.getCreator().getId().equals(teacherId)) {
            return null;
        }
        return classroom;
    }

    @Override
    public List<ClassJoining> getActiveMembers(Long classroomId) {
        return classJoiningRepository.findByClassroomIdAndStatus(classroomId, JoinStatus.APPROVED);
    }

    @Override
    public List<ClassJoining> getPendingMembers(Long classroomId) {
        return classJoiningRepository.findByClassroomIdAndStatus(classroomId, JoinStatus.PENDING);
    }

    @Override
    public List<QuizAssigning> getAssignedQuizzes(Long classroomId) {
        return quizAssigningRepository.findByClassroomId(classroomId);
    }

    @Override
    public List<Quiz> getTeacherQuizzes(Long teacherId) {
        return quizRepository.findByCreatorIdAndIsEnableTrue(teacherId);
    }

    @Override
    public List<ClassTopic> getClassTopics(Long classroomId) {
        return classTopicRepository.findByClassroomId(classroomId);
    }

    @Override
    public List<Category> getTeacherCategories(Long teacherId) {
        return categoryRepository.findAllByCreatorIdWithParent(teacherId);
    }
}

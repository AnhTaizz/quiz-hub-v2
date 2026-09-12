package com.example.quizhub.service.student;

import com.example.quizhub.entity.ClassJoining;
import com.example.quizhub.entity.ClassTopic;
import com.example.quizhub.entity.Classroom;
import com.example.quizhub.entity.QuizAssigning;

import java.util.List;

public interface StudentClassroomService {
    List<ClassJoining> getJoinedClassrooms(Long studentId);
    
    ClassJoining getJoiningStatus(Long classroomId, Long studentId);
    
    Classroom getClassroomById(Long classroomId);
    
    List<QuizAssigning> getAssignedQuizzesForClassroom(Long classroomId, Long studentId);
    
    List<ClassTopic> getClassTopics(Long classroomId);
}

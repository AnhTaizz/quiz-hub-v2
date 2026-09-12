package com.example.quizhub.service.teacher;

import com.example.quizhub.entity.Category;
import com.example.quizhub.entity.ClassJoining;
import com.example.quizhub.entity.ClassTopic;
import com.example.quizhub.entity.Classroom;
import com.example.quizhub.entity.Quiz;
import com.example.quizhub.entity.QuizAssigning;

import java.util.List;
import java.util.Map;

public interface TeacherClassroomWebService {
    List<Classroom> getTeacherClassrooms(Long teacherId);
    
    Map<Long, Long> getActiveMemberCounts(List<Classroom> classrooms);
    
    Classroom getClassroomByIdAndTeacher(Long classroomId, Long teacherId);
    
    List<ClassJoining> getActiveMembers(Long classroomId);
    
    List<ClassJoining> getPendingMembers(Long classroomId);
    
    List<QuizAssigning> getAssignedQuizzes(Long classroomId);
    
    List<Quiz> getTeacherQuizzes(Long teacherId);
    
    List<ClassTopic> getClassTopics(Long classroomId);
    
    List<Category> getTeacherCategories(Long teacherId);
}

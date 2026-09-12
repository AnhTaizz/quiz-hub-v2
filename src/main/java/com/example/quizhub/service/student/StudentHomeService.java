package com.example.quizhub.service.student;

import com.example.quizhub.dto.student.QuizDashboardInfoDTO;
import com.example.quizhub.dto.student.StudentHomeDashboardDTO;
import com.example.quizhub.entity.Attempt;
import com.example.quizhub.entity.ClassJoining;
import com.example.quizhub.entity.QuizAssigning;
import com.example.quizhub.entity.User;

import java.util.List;

public interface StudentHomeService {
    StudentHomeDashboardDTO getDashboardData(String email);
    
    List<QuizDashboardInfoDTO> getAllQuizzes(String email);
    
    List<ClassJoining> getApprovedClasses(String email);
    
    QuizAssigning getQuizAssigningById(Long assigningId);
    
    List<Attempt> getQuizHistory(Long assigningId, String email);
    
    List<Attempt> getAllQuizAttempts(String email);
    
    User getStudentByEmail(String email);
}

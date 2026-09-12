package com.example.quizhub.service.teacher;

import com.example.quizhub.dto.teacher.response.TeacherHomeDashboardDTO;

public interface TeacherHomeService {
    TeacherHomeDashboardDTO getDashboardData(String email);
}

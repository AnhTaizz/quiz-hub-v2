package com.example.quizhub.controller.teacher;

import java.security.Principal;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import com.example.quizhub.dto.teacher.response.TeacherHomeDashboardDTO;
import com.example.quizhub.service.teacher.TeacherHomeService;

import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/teacher")
@RequiredArgsConstructor
public class TeacherHomeController {
    private final TeacherHomeService teacherHomeService;

    @GetMapping
    public String getTeacherDashboard(Principal principal, Model model) {
        TeacherHomeDashboardDTO dashboardData = teacherHomeService.getDashboardData(principal.getName());

        model.addAttribute("classroomCount", dashboardData.getClassroomCount());
        model.addAttribute("questionCount", dashboardData.getQuestionCount());
        model.addAttribute("studentCount", dashboardData.getStudentCount());
        model.addAttribute("assignments", dashboardData.getAssignments());
        model.addAttribute("liveQuizCount", dashboardData.getLiveQuizCount());
        model.addAttribute("currentUser", dashboardData.getCurrentUser());

        return "teacher/teacher-home";
    }
}

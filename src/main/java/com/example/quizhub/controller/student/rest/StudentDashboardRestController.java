package com.example.quizhub.controller.student.rest;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.student.AssignedQuizSummaryDTO;
import com.example.quizhub.dto.student.StudentDashboardResponseDTO;
import com.example.quizhub.dto.student.StudentHomeDashboardDTO;
import com.example.quizhub.service.student.StudentHomeService;

import lombok.RequiredArgsConstructor;

/**
 * JSON counterpart of the Thymeleaf-only StudentHomeController#home
 * ("/student"). Reuses StudentHomeService exactly as the legacy controller
 * does; no new business logic, just a JSON-safe response shape for the React
 * SPA.
 */
@RestController
@RequestMapping("/api/student/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentDashboardRestController {

    private final StudentHomeService studentHomeService;

    @GetMapping
    public ResponseEntity<StudentDashboardResponseDTO> getDashboard(Principal principal) {
        StudentHomeDashboardDTO data = studentHomeService.getDashboardData(principal.getName());

        List<AssignedQuizSummaryDTO> assignedQuizzes = data.getAssignedQuizzes() == null
                ? List.of()
                : data.getAssignedQuizzes().stream().map(AssignedQuizSummaryDTO::fromDashboardInfo).toList();

        StudentDashboardResponseDTO response = StudentDashboardResponseDTO.builder()
                .greeting(getGreeting())
                .totalCompleted(data.getTotalCompleted())
                .quizAvg(data.getQuizAvg())
                .practiceAvg(data.getPracticeAvg())
                .pendingCount(data.getPendingCount())
                .pendingThisWeekCount(data.getPendingThisWeekCount())
                .assignedQuizzes(assignedQuizzes)
                .build();

        return ResponseEntity.ok(response);
    }

    private String getGreeting() {
        int hour = LocalDateTime.now().getHour();
        if (hour >= 5 && hour < 11)
            return "Chào buổi sáng";
        if (hour >= 11 && hour < 13)
            return "Chào buổi trưa";
        if (hour >= 13 && hour < 18)
            return "Chào buổi chiều";
        if (hour >= 18 && hour < 24)
            return "Chào buổi tối";
        return "Chào buổi đêm";
    }
}

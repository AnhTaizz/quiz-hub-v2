package com.example.quizhub.controller.teacher;

import java.util.List;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

import com.example.quizhub.entity.AttemptViolation;
import com.example.quizhub.entity.QuizAssigning;
import com.example.quizhub.entity.User;
import com.example.quizhub.repository.AttemptViolationRepository;
import com.example.quizhub.repository.QuizAssigningRepository;

import lombok.RequiredArgsConstructor;

import com.example.quizhub.repository.UserRepository;
import java.security.Principal;

@Controller
@RequestMapping("/teacher/monitoring")
@RequiredArgsConstructor
public class TeacherMonitoringWebController {

    private final QuizAssigningRepository quizAssigningRepository;
    private final AttemptViolationRepository attemptViolationRepository;
    private final UserRepository userRepository;

    @GetMapping
    public String viewMonitoringOverview(Principal principal, Model model) {
        User teacher = userRepository.findByEmail(principal.getName()).orElseThrow();
        model.addAttribute("currentUser", teacher);

        List<QuizAssigning> assignments = quizAssigningRepository.findByClassroomCreatorId(teacher.getId());
        model.addAttribute("assignments", assignments);

        return "teacher/monitoring-overview";
    }

    @GetMapping("/log/{assigningId}")
    public String viewViolationLog(@PathVariable Long assigningId, Principal principal, Model model) {
        QuizAssigning assignment = quizAssigningRepository.findByIdIncludingDeleted(assigningId)
                .orElseThrow(() -> new RuntimeException("Assignment not found"));
        List<AttemptViolation> violations = attemptViolationRepository.findAllByAssigningId(assigningId);

        model.addAttribute("assignment", assignment);
        model.addAttribute("violations", violations);

        User teacher = userRepository.findByEmail(principal.getName()).orElseThrow();
        model.addAttribute("currentUser", teacher);

        return "teacher/monitoring-log";
    }

    @GetMapping("/attempt/{attemptId}")
    public String viewAttemptDetail(@PathVariable Long attemptId, Model model) {
        model.addAttribute("attemptId", attemptId);
        return "teacher/teacher-quiz-result";
    }
}

package com.example.quizhub.controller.student;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import com.example.quizhub.entity.QuizAssigning;
import com.example.quizhub.entity.Attempt;
import com.example.quizhub.service.student.StudentHomeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.util.List;

/**
 * Legacy Thymeleaf student pages that have NOT been migrated to React.
 * The dashboard ("/student"), quiz list, quiz play/result and combined
 * history now live in the React SPA (see SpaController), backed by the JSON
 * endpoints in StudentDashboardRestController / StudentQuizRestController.
 */
@Controller
@RequestMapping("/student")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
@Slf4j
public class StudentHomeController {

    private final StudentHomeService studentHomeService;

    @GetMapping("/quiz/history/{assigningId}")
    public String quizHistory(@PathVariable Long assigningId, Model model) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();

        QuizAssigning assigning = studentHomeService.getQuizAssigningById(assigningId);
        List<Attempt> attempts = studentHomeService.getQuizHistory(assigningId, email);

        model.addAttribute("assigning", assigning);
        model.addAttribute("attempts", attempts);
        return "student/student-quiz-history";
    }
}

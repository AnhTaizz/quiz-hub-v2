package com.example.quizhub.controller.student;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/student/practice")
@PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
public class StudentPracticeWebController {

    @GetMapping("/play")
    public String playPractice() {
        return "student/practice-play";
    }

    @GetMapping("/review/{id}")
    public String reviewPractice(@PathVariable Long id, Model model) {
        model.addAttribute("reviewPracticeId", id);
        return "student/practice-play";
    }
}

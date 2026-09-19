package com.example.quizhub.controller.student;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * "/student/practice", "/student/practice/play" and "/student/practice/review/{id}" are now owned by the React SPA
 * (see SpaController). The only practice page still rendered by Thymeleaf is the stateless personal-quiz practice
 * (started from the still-legacy question library): no server-side practice exists for it, so the legacy player grades
 * it in the browser. The React player hands such sessions off here; the legacy script reads the same sessionStorage
 * keys it always did.
 */
@Controller
@RequestMapping("/student/practice")
@PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
public class StudentPracticeWebController {

    @GetMapping("/personal-play")
    public String personalPractice() {
        return "student/practice-play";
    }
}

package com.example.quizhub.controller.student;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/student/quiz")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentQuizWebController {

    @GetMapping("/create")
    public String getCreateQuizPage(@RequestParam(required = false) Long categoryId, Model model) {
        model.addAttribute("categoryId", categoryId);
        return "student/student-quiz-create";
    }

    @GetMapping("/quick-create")
    public String getQuickCreateQuizPage(Model model) {
        return "student/student-quiz-quick-create";
    }

    @GetMapping("/ai-create")
    public String getAiCreateQuizPage(@RequestParam(required = false) Long categoryId, Model model) {
        model.addAttribute("categoryId", categoryId);
        return "student/student-quiz-ai-create";
    }

    @GetMapping("/{id}/edit")
    public String getEditQuizPage(@PathVariable String id, Model model) {
        model.addAttribute("quizId", id);
        return "student/student-quiz-create";
    }


    @GetMapping("/play")
    public String getPlayQuizPage(@RequestParam(required = false) Long attemptId, @RequestParam(required = false) Long quizId, Model model) {
        model.addAttribute("attemptId", attemptId);
        model.addAttribute("quizId", quizId);
        return "student/quiz-play-student";
    }

    @GetMapping("/result")
    public String getResultQuizPage(@RequestParam Long attemptId, Model model) {
        model.addAttribute("attemptId", attemptId);
        return "student/quiz-result";
    }
}

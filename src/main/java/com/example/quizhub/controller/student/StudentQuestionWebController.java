package com.example.quizhub.controller.student;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import com.example.quizhub.service.CategoryService;

import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/student/questions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentQuestionWebController {

    private final CategoryService categoryService;

    @GetMapping
    public String getQuestionsPage(Model model) {
        model.addAttribute("myCategories", categoryService.getMyCategories());
        // Students don't see public categories in their management view for now
        return "student/student-questions";
    }
}

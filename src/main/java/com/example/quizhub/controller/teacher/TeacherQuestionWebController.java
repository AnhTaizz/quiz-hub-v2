package com.example.quizhub.controller.teacher;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import com.example.quizhub.service.CategoryService;

import lombok.RequiredArgsConstructor;

@Controller
@RequestMapping("/teacher/questions")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class TeacherQuestionWebController {

    private final CategoryService categoryService;

    @GetMapping
    public String getQuestionsPage(Model model) {
        model.addAttribute("myCategories", categoryService.getMyCategories());
        model.addAttribute("publicCategories", categoryService.getPublicCategories());
        return "teacher/teacher-questions";
    }
}

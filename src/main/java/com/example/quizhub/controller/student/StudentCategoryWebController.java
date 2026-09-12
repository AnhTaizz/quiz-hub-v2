package com.example.quizhub.controller.student;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Web controller cho trang danh mục của học sinh.
 * Cùng một template, phân biệt qua param &type=public|mine.
 */
@Controller
@RequestMapping("/student/categories")
@PreAuthorize("hasRole('STUDENT')")
public class StudentCategoryWebController {

    @GetMapping
    public String categoriesPage(
            @RequestParam(value = "type", defaultValue = "public") String type,
            Model model) {
        model.addAttribute("viewType", type);
        model.addAttribute("isPublicView", "public".equals(type));

        if ("public".equals(type)) {
            return "student/student-categories-public";
        } else {
            return "student/student-categories-mine";
        }
    }
}

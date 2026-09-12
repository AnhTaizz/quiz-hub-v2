package com.example.quizhub.controller.admin;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/admin")
public class AdminHomeController {

    @GetMapping
    public String adminHome(Model model) {
        return "admin/admin-home";
    }

    @GetMapping("/users")
    public String adminUsers(Model model) {
        return "admin/admin-users";
    }

    @GetMapping("/categories")
    public String adminCategories(Model model) {
        return "admin/admin-categories";
    }

    @GetMapping("/reports")
    public String adminReports(Model model) {
        return "admin/admin-reports";
    }

    @GetMapping("/moderation")
    public String adminModeration(Model model) {
        return "admin/admin-moderation";
    }
}

package com.example.quizhub.controller.student;

import com.example.quizhub.entity.User;
import com.example.quizhub.service.classroom.ClassroomService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/**
 * The classroom list and detail pages ("/student/classrooms",
 * "/student/classrooms/{id}") now live in the React SPA (see SpaController),
 * backed by StudentClassroomController's JSON endpoints. Only the legacy
 * form-post join handler remains here for the still-Thymeleaf pages that
 * submit to it.
 */
@Controller
@RequestMapping("/student/classrooms")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentClassroomWebController {

    private final ClassroomService classroomService;

    @PostMapping("/join")
    public String joinClass(@RequestParam String code, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            try {
                classroomService.joinClass(user.getEmail(), code);
                redirectAttributes.addFlashAttribute("successMessage", "Yêu cầu tham gia đã được gửi thành công!");
            } catch (Exception e) {
                redirectAttributes.addFlashAttribute("errorMessage", "Lỗi: " + e.getMessage());
            }
        }
        return "redirect:/student/classrooms";
    }
}

package com.example.quizhub.controller.student;

import com.example.quizhub.entity.ClassJoining;
import com.example.quizhub.entity.ClassTopic;
import com.example.quizhub.entity.QuizAssigning;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.service.student.StudentClassroomService;
import com.example.quizhub.service.classroom.ClassroomService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;
import java.util.stream.Collectors;

@Controller
@RequestMapping("/student/classrooms")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentClassroomWebController {

    private final ClassroomService classroomService;
    private final StudentClassroomService studentClassroomService;

    @GetMapping
    public String listClassrooms(Model model) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            List<ClassJoining> joinedClasses = studentClassroomService.getJoinedClassrooms(user.getId());
            model.addAttribute("joinedClasses", joinedClasses);
            model.addAttribute("currentUser", user);
        }
        return "student/student-classrooms";
    }

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

    @GetMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    public String classroomDetailPage(@PathVariable Long id, Model model) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            // Check if the student is approved to join the class
            ClassJoining joining = studentClassroomService.getJoiningStatus(id, user.getId());

            if (joining == null || joining.getStatus() != JoinStatus.APPROVED) {
                return "redirect:/student/classrooms";
            }

            com.example.quizhub.entity.Classroom classroom = studentClassroomService.getClassroomById(id);

            List<QuizAssigning> assignedQuizzes = studentClassroomService.getAssignedQuizzesForClassroom(id, user.getId());
            List<ClassTopic> topics = studentClassroomService.getClassTopics(id);

            model.addAttribute("classroom", classroom);
            model.addAttribute("assignedQuizzes", assignedQuizzes);
            model.addAttribute("topics", topics);
            model.addAttribute("currentUser", user);
            model.addAttribute("now", java.time.LocalDateTime.now());
        }
        return "student/student-classroom-detail";
    }
}

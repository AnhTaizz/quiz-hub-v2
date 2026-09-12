package com.example.quizhub.controller.teacher;

import com.example.quizhub.dto.classroom.request.ClassroomRequestDTO;
import com.example.quizhub.entity.Category;
import com.example.quizhub.entity.ClassJoining;
import com.example.quizhub.entity.ClassTopic;
import com.example.quizhub.entity.Classroom;
import com.example.quizhub.entity.Quiz;
import com.example.quizhub.entity.QuizAssigning;
import com.example.quizhub.entity.User;
import com.example.quizhub.service.classroom.ClassroomService;
import com.example.quizhub.service.teacher.TeacherClassroomWebService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.time.LocalDateTime;
import java.util.List;

@Controller
@RequestMapping("/teacher/classrooms")
@RequiredArgsConstructor
public class TeacherClassroomWebController {

    private final ClassroomService classroomService;
    private final TeacherClassroomWebService teacherClassroomWebService;
    private final com.example.quizhub.service.CategoryService categoryService;

    @GetMapping
    public String classroomPage(Model model) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            List<Classroom> classrooms = teacherClassroomWebService.getTeacherClassrooms(user.getId());
            model.addAttribute("classrooms", classrooms);
            
            java.util.Map<Long, Long> memberCounts = teacherClassroomWebService.getActiveMemberCounts(classrooms);
            model.addAttribute("memberCounts", memberCounts);
            
            model.addAttribute("currentUser", user);
        }
        return "teacher/teacher-classrooms";
    }

    @PostMapping
    public String createClassroom(@ModelAttribute ClassroomRequestDTO request, RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            try {
                classroomService.createClassroom(user.getEmail(), request);
                redirectAttributes.addFlashAttribute("successMessage", "Tạo lớp học thành công!");
            } catch (Exception e) {
                redirectAttributes.addFlashAttribute("errorMessage", "Lỗi: " + e.getMessage());
            }
        }
        return "redirect:/teacher/classrooms";
    }

    @GetMapping("/{id}/members")
    public String memberManagementPage(@PathVariable Long id, Model model) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            Classroom classroom = teacherClassroomWebService.getClassroomByIdAndTeacher(id, user.getId());

            if (classroom == null) {
                return "redirect:/teacher/classrooms";
            }

            List<ClassJoining> activeMembers = teacherClassroomWebService.getActiveMembers(id);
            List<ClassJoining> pendingRequests = teacherClassroomWebService.getPendingMembers(id);

            model.addAttribute("classroom", classroom);
            model.addAttribute("activeMembers", activeMembers);
            model.addAttribute("pendingRequests", pendingRequests);
            model.addAttribute("currentUser", user);
        }
        return "teacher/teacher-classroom-members";
    }

    @PostMapping("/{id}/approve/{joiningId}")
    public String approveMember(@PathVariable Long id, @PathVariable Long joiningId,
            RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            try {
                classroomService.approveJoinRequest(joiningId, user.getEmail());
                redirectAttributes.addFlashAttribute("successMessage", "Đã phê duyệt thành viên!");
            } catch (Exception e) {
                redirectAttributes.addFlashAttribute("errorMessage", "Lỗi: " + e.getMessage());
            }
        }
        return "redirect:/teacher/classrooms/" + id + "/members";
    }

    @PostMapping("/{id}/reject/{joiningId}")
    public String rejectMember(@PathVariable Long id, @PathVariable Long joiningId,
            RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            try {
                classroomService.rejectJoinRequest(joiningId, user.getEmail());
                redirectAttributes.addFlashAttribute("successMessage", "Đã từ chối yêu cầu tham gia!");
            } catch (Exception e) {
                redirectAttributes.addFlashAttribute("errorMessage", "Lỗi: " + e.getMessage());
            }
        }
        return "redirect:/teacher/classrooms/" + id + "/members";
    }

    @PostMapping("/{id}/remove/{studentId}")
    public String removeStudent(@PathVariable Long id, @PathVariable Long studentId,
            RedirectAttributes redirectAttributes) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            try {
                classroomService.removeStudentFromClass(id, studentId, user.getEmail());
                redirectAttributes.addFlashAttribute("successMessage", "Đã xóa sinh viên khỏi lớp!");
            } catch (Exception e) {
                redirectAttributes.addFlashAttribute("errorMessage", "Lỗi: " + e.getMessage());
            }
        }
        return "redirect:/teacher/classrooms/" + id + "/members";
    }

    @GetMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    public String classroomDetailPage(@PathVariable Long id, Model model) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof User user) {
            Classroom classroom = teacherClassroomWebService.getClassroomByIdAndTeacher(id, user.getId());

            if (classroom == null) {
                return "redirect:/teacher/classrooms";
            }

            List<QuizAssigning> assignedQuizzes = teacherClassroomWebService.getAssignedQuizzes(id);
            List<Quiz> quizzes = teacherClassroomWebService.getTeacherQuizzes(user.getId());
            List<ClassTopic> topics = teacherClassroomWebService.getClassTopics(id);
            List<Category> categories = teacherClassroomWebService.getTeacherCategories(user.getId());

            model.addAttribute("classroom", classroom);
            model.addAttribute("assignedQuizzes", assignedQuizzes);
            model.addAttribute("quizzes", quizzes);
            model.addAttribute("topics", topics);
            model.addAttribute("categories", categories);
            model.addAttribute("myCategories", categoryService.getMyCategories());
            model.addAttribute("publicCategories", categoryService.getPublicCategories());
            model.addAttribute("today", LocalDateTime.now().withSecond(0).withNano(0));
            model.addAttribute("nextWeek",
                    LocalDateTime.now().plusDays(7).withHour(23).withMinute(59).withSecond(0).withNano(0));
            model.addAttribute("currentUser", user);
        }
        return "teacher/teacher-classroom-detail";
    }
}

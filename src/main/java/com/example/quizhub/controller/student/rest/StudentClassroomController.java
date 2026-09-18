package com.example.quizhub.controller.student.rest;

import java.security.Principal;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.classroom.response.ClassTopicResponseDTO;
import com.example.quizhub.dto.student.AssignedQuizSummaryDTO;
import com.example.quizhub.dto.student.StudentClassroomDetailResponseDTO;
import com.example.quizhub.dto.student.StudentClassroomSummaryDTO;
import com.example.quizhub.entity.Classroom;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.service.classroom.ClassroomService;
import com.example.quizhub.service.student.StudentClassroomService;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/student/classrooms")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentClassroomController {

    private final ClassroomService classroomService;
    private final StudentClassroomService studentClassroomService;
    private final UserRepository userRepository;

    @PostMapping("/join")
    public ResponseEntity<String> joinClass(Principal principal, @RequestParam String code) {
        classroomService.joinClass(principal.getName(), code);
        return ResponseEntity.ok("Đã tham gia lớp học thành công!");
    }

    /**
     * JSON counterpart of the Thymeleaf-only
     * StudentClassroomWebController#listClassrooms ("/student/classrooms").
     * Reuses the same service call; no new business logic.
     */
    @GetMapping
    public ResponseEntity<List<StudentClassroomSummaryDTO>> listClassrooms(Principal principal) {
        User user = userRepository.findByEmail(principal.getName()).orElseThrow();
        List<StudentClassroomSummaryDTO> classrooms = studentClassroomService.getJoinedClassrooms(user.getId())
                .stream()
                .map(StudentClassroomSummaryDTO::fromJoining)
                .toList();
        return ResponseEntity.ok(classrooms);
    }

    /**
     * JSON counterpart of the Thymeleaf-only
     * StudentClassroomWebController#classroomDetailPage ("/student/classrooms/{id}").
     * Preserves the same APPROVED-membership gate the legacy controller enforces
     * (there it silently redirects to the list page instead; here it responds
     * with the existing USER_NOT_IN_CLASS error, since a JSON API cannot redirect
     * a browser-invisible fetch call).
     */
    @GetMapping("/{id}")
    public ResponseEntity<StudentClassroomDetailResponseDTO> getClassroomDetail(Principal principal, @PathVariable Long id) {
        User user = userRepository.findByEmail(principal.getName()).orElseThrow();

        var joining = studentClassroomService.getJoiningStatus(id, user.getId());
        if (joining == null || joining.getStatus() != JoinStatus.APPROVED) {
            throw new AppException(ErrorCode.USER_NOT_IN_CLASS);
        }

        Classroom classroom = studentClassroomService.getClassroomById(id);
        if (classroom == null) {
            throw new AppException(ErrorCode.CLASSROOM_NOT_FOUND);
        }

        List<AssignedQuizSummaryDTO> assignedQuizzes = studentClassroomService
                .getAssignedQuizzesForClassroom(id, user.getId())
                .stream()
                .map(AssignedQuizSummaryDTO::fromAssigning)
                .toList();

        List<ClassTopicResponseDTO> topics = studentClassroomService.getClassTopics(id)
                .stream()
                .map(ClassTopicResponseDTO::fromEntity)
                .toList();

        StudentClassroomDetailResponseDTO response = StudentClassroomDetailResponseDTO.builder()
                .id(classroom.getId())
                .code(classroom.getCode())
                .name(classroom.getName())
                .description(classroom.getDescription())
                .imageUrl(classroom.getImageUrl())
                .teacherName(classroom.getCreator() != null ? classroom.getCreator().getFullName() : null)
                .topics(topics)
                .assignedQuizzes(assignedQuizzes)
                .build();

        return ResponseEntity.ok(response);
    }
}

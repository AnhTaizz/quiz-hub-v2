package com.example.quizhub.controller.teacher.rest;

import java.security.Principal;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.classroom.request.ClassroomRequestDTO;
import com.example.quizhub.dto.classroom.response.ClassroomResponseDTO;
import com.example.quizhub.dto.classroom.response.MemberResponseDTO;
import com.example.quizhub.dto.quiztaking.response.QuizResultResponseDTO;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.service.classroom.ClassroomService;
import com.example.quizhub.service.quiz.QuizTakingService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/teacher/classrooms")
@RequiredArgsConstructor
public class TeacherClassroomController {

    private final ClassroomService classroomService;
    private final QuizTakingService quizTakingService;
    private final com.example.quizhub.repository.ClassroomRepository classroomRepository;
    private final com.example.quizhub.repository.UserRepository userRepository;
    private final com.example.quizhub.repository.ClassJoiningRepository classJoiningRepository;
    private final com.example.quizhub.repository.QuizTakingRepository quizTakingRepository;
    private final com.example.quizhub.repository.AttemptRepository attemptRepository;
    private final com.example.quizhub.repository.QuizAssigningRepository quizAssigningRepository;

    @GetMapping
    public ResponseEntity<List<ClassroomResponseDTO>> getMyClassrooms(Principal principal) {
        com.example.quizhub.entity.User user = userRepository.findByEmail(principal.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        List<ClassroomResponseDTO> list = classroomRepository.findByCreatorId(user.getId()).stream()
                .map(c -> ClassroomResponseDTO.builder()
                        .id(c.getId())
                        .name(c.getName())
                        .description(c.getDescription())
                        .code(c.getCode())
                        .teacherName(user.getFullName())
                        .createdAt(c.getCreatedAt())
                        .build())
                .toList();
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<ClassroomResponseDTO> createClassroom(
            Principal principal,
            @RequestBody @Valid ClassroomRequestDTO request) {
        return ResponseEntity.ok(classroomService.createClassroom(principal.getName(), request));
    }

    @GetMapping("/{classroomId}/students")
    public ResponseEntity<List<MemberResponseDTO>> getMembersInClass(
            Principal principal,
            @PathVariable Long classroomId) {

        return ResponseEntity.ok(classroomService.getMembersInClass(classroomId, principal.getName()));
    }

    @DeleteMapping("/{classroomId}/students/{studentId}")
    public ResponseEntity<String> removeStudent(
            Principal principal,
            @PathVariable Long classroomId,
            @PathVariable Long studentId) {

        classroomService.removeStudentFromClass(classroomId, studentId, principal.getName());
        return ResponseEntity.ok("Đã kích học sinh khỏi lớp!");
    }

    @GetMapping("/assigned-quizzes/{assigningId}/grades")
    public ResponseEntity<List<com.example.quizhub.dto.classroom.response.GradeResponseDTO>> getGradesByAssignment(
            Principal principal,
            @PathVariable Long assigningId) {

        com.example.quizhub.entity.QuizAssigning assigning = quizAssigningRepository.findByIdIncludingDeleted(assigningId)
                .orElseThrow(() -> new RuntimeException("Assignment not found"));

        List<com.example.quizhub.entity.ClassJoining> members = classJoiningRepository.findByClassroomIdAndStatus(
                assigning.getClassroom().getId(), com.example.quizhub.entity.enums.JoinStatus.APPROVED);

        String assignedIdsStr = assigning.getAssignedStudentIds();
        if (assignedIdsStr != null && !assignedIdsStr.trim().isEmpty()) {
            java.util.List<String> assignedIdsList = java.util.Arrays.asList(assignedIdsStr.split(","));
            members = members.stream()
                    .filter(cj -> assignedIdsList.contains(String.valueOf(cj.getLearner().getId())))
                    .collect(java.util.stream.Collectors.toList());
        }

        List<com.example.quizhub.dto.classroom.response.GradeResponseDTO> list = members.stream().map(cj -> {
            com.example.quizhub.entity.User student = cj.getLearner();
            java.util.Optional<com.example.quizhub.entity.QuizTaking> takingOpt = quizTakingRepository
                    .findByLearnerIdAndQuizAssigningId(
                            student.getId(), assigningId);

            java.math.BigDecimal highestScore = null;
            int attemptCount = 0;
            String status = "Chưa bắt đầu";

            if (takingOpt.isPresent()) {
                com.example.quizhub.entity.QuizTaking taking = takingOpt.get();

                List<com.example.quizhub.entity.Attempt> attempts = attemptRepository
                        .findByQuizTakingId(taking.getId());
                attemptCount = attempts.size();

                // Tính điểm cao nhất từ các lượt đã nộp (có endedAt)
                for (com.example.quizhub.entity.Attempt att : attempts) {
                    if (att.getResult() != null) {
                        if (highestScore == null || att.getResult().compareTo(highestScore) > 0) {
                            highestScore = att.getResult();
                        }
                    }
                }

                // Xác định trạng thái dựa trên lượt làm thực tế:
                // - Nếu có ít nhất 1 lượt đã nộp (endedAt != null) → "Đã nộp bài"
                // - Nếu có lượt đang làm nhưng chưa nộp lần nào → "Đang làm bài"
                // - Không có lượt nào → "Chưa bắt đầu" (handled below)
                boolean hasSubmitted = attempts.stream()
                        .anyMatch(att -> att.getEndedAt() != null);
                boolean hasInProgress = attempts.stream()
                        .anyMatch(att -> att.getEndedAt() == null);

                if (hasSubmitted) {
                    status = "Đã nộp bài";
                } else if (hasInProgress) {
                    status = "Đang làm bài";
                }
            }

            return com.example.quizhub.dto.classroom.response.GradeResponseDTO.builder()
                    .studentId(student.getId())
                    .fullName(student.getFullName())
                    .email(student.getEmail())
                    .highestScore(highestScore)
                    .attemptCount(attemptCount)
                    .status(status)
                    .build();
        }).toList();

        return ResponseEntity.ok(list);
    }

    @GetMapping("/assigned-quizzes/{assigningId}/students/{studentId}/history")
    public ResponseEntity<List<com.example.quizhub.dto.quiztaking.response.QuizAttemptSummaryDTO>> getStudentAttemptHistory(
            @PathVariable Long assigningId,
            @PathVariable Long studentId) {
        
        java.util.Optional<com.example.quizhub.entity.QuizTaking> takingOpt = quizTakingRepository
                .findByLearnerIdAndQuizAssigningId(studentId, assigningId);
        
        if (takingOpt.isEmpty()) {
            return ResponseEntity.ok(java.util.Collections.emptyList());
        }
        
        List<com.example.quizhub.dto.quiztaking.response.QuizAttemptSummaryDTO> list = attemptRepository
                .findByQuizTakingId(takingOpt.get().getId()).stream()
                .map(a -> com.example.quizhub.dto.quiztaking.response.QuizAttemptSummaryDTO.builder()
                        .id(a.getId())
                        .result(a.getResult())
                        .totalQuestNum(a.getTotalQuestNum())
                        .correctNum(a.getCorrectNum())
                        .incorrectNum(a.getIncorrectNum())
                        .startedAt(a.getStartedAt())
                        .endedAt(a.getEndedAt())
                        .build())
                .sorted((a1, a2) -> a2.getStartedAt().compareTo(a1.getStartedAt()))
                .toList();
                
        return ResponseEntity.ok(list);
    }

    @GetMapping("/assigned-quizzes/{assigningId}/statistics")
    public ResponseEntity<com.example.quizhub.dto.classroom.response.AssignmentStatisticsDTO> getAssignmentStatistics(
            Principal principal,
            @PathVariable Long assigningId) {
        return ResponseEntity.ok(classroomService.getAssignmentStatistics(assigningId, principal.getName()));
    }

    @org.springframework.web.bind.annotation.PutMapping("/{classroomId}")
    public ResponseEntity<com.example.quizhub.dto.classroom.response.ClassroomResponseDTO> updateClassroom(
            Principal principal,
            @PathVariable Long classroomId,
            @RequestBody @jakarta.validation.Valid com.example.quizhub.dto.classroom.request.ClassroomRequestDTO request) {
        return ResponseEntity.ok(classroomService.updateClassroom(classroomId, request, principal.getName()));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/{classroomId}")
    public ResponseEntity<Void> deleteClassroom(
            Principal principal,
            @PathVariable Long classroomId) {
        classroomService.deleteClassroom(classroomId, principal.getName());
        return ResponseEntity.noContent().build();
    }

    @org.springframework.web.bind.annotation.PostMapping("/{classroomId}/import-students")
    public ResponseEntity<java.util.Map<String, Object>> importStudents(
            Principal principal,
            @PathVariable Long classroomId,
            @org.springframework.web.bind.annotation.RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        return ResponseEntity.ok(classroomService.importStudentsFromExcel(classroomId, file, principal.getName()));
    }

    @GetMapping("/assigned-quizzes/attempts/{attemptId}/result")
    public ResponseEntity<QuizResultResponseDTO> getQuizResult(
            Principal principal,
            @PathVariable Long attemptId) {
        com.example.quizhub.entity.User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return ResponseEntity.ok(quizTakingService.getQuizResult(user.getId(), attemptId));
    }
}

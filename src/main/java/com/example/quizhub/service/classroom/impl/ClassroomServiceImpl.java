package com.example.quizhub.service.classroom.impl;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

import org.springframework.stereotype.Service;

import com.example.quizhub.dto.classroom.request.ClassroomRequestDTO;
import com.example.quizhub.dto.classroom.response.AssignmentStatisticsDTO;
import com.example.quizhub.dto.classroom.response.ClassroomResponseDTO;
import com.example.quizhub.dto.classroom.response.MemberResponseDTO;
import com.example.quizhub.entity.Attempt;
import com.example.quizhub.entity.ClassJoining;
import com.example.quizhub.entity.Classroom;
import com.example.quizhub.entity.QuizTaking;
import com.example.quizhub.entity.User;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.ClassJoiningRepository;
import com.example.quizhub.repository.ClassroomRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.service.NotificationService;
import com.example.quizhub.service.classroom.ClassroomService;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.NotificationType;
import com.example.quizhub.entity.enums.TakingStatus;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.web.multipart.MultipartFile;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ClassroomServiceImpl implements ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final UserRepository userRepository;
    private final ClassJoiningRepository classJoiningRepository;
    private final NotificationService notificationService;
    private final com.example.quizhub.repository.QuizAssigningRepository quizAssigningRepository;
    private final com.example.quizhub.repository.QuizTakingRepository quizTakingRepository;
    private final com.example.quizhub.repository.AttemptRepository attemptRepository;

    @Override
    public ClassroomResponseDTO createClassroom(String teacherEmail, ClassroomRequestDTO request) {
        User teacher = userRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        String joinCode = generateUniqueCode();

        String defaultImage = "https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&w=400&q=80";
        String imageUrl = request.getImageUrl();
        if (imageUrl == null || imageUrl.isBlank()) {
            imageUrl = defaultImage;
        }

        Classroom classroom = Classroom.builder()
                .name(request.getName())
                .description(request.getDescription())
                .code(joinCode)
                .imageUrl(imageUrl)
                .requireApproval(request.getRequireApproval() != null ? request.getRequireApproval() : false)
                .isEnable(true)
                .isDraft(false)
                .creator(teacher)
                .build();

        classroomRepository.save(classroom);

        return ClassroomResponseDTO.builder()
                .id(classroom.getId())
                .name(classroom.getName())
                .description(classroom.getDescription())
                .code(classroom.getCode())
                .teacherName(teacher.getFullName())
                .createdAt(classroom.getCreatedAt())
                .build();
    }

    private String generateUniqueCode() {
        String characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder code = new StringBuilder();
        Random rnd = new Random();

        while (true) {
            code.setLength(0);
            for (int i = 0; i < 6; i++) {
                code.append(characters.charAt(rnd.nextInt(characters.length())));
            }
            if (!classroomRepository.existsByCode(code.toString())) {
                return code.toString();
            }
        }
    }

    @Override
    public List<MemberResponseDTO> getMembersInClass(Long classroomId, String teacherEmail) {
        User teacher = userRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new AppException(ErrorCode.CLASSROOM_NOT_FOUND));

        if (!classroom.getCreator().getId().equals(teacher.getId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        var joinings = classJoiningRepository.findByClassroomId(classroomId);

        return joinings.stream().map(join -> MemberResponseDTO.builder()
                .studentId(join.getLearner().getId())
                .fullName(join.getDisplayedName()) // Lấy tên hiển thị trong lớp
                .email(join.getLearner().getEmail())
                .phone(join.getDisplayedPhone())
                .joinedAt(join.getJoinedAt())
                .build()).toList();
    }

    @Override
    public void removeStudentFromClass(Long classroomId, Long studentId, String teacherEmail) {
        User teacher = userRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new AppException(ErrorCode.CLASSROOM_NOT_FOUND));

        if (!classroom.getCreator().getId().equals(teacher.getId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        ClassJoining joiningRecord = classJoiningRepository
                .findByClassroomIdAndLearnerId(classroomId, studentId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_IN_CLASS));

        joiningRecord.setStatus(JoinStatus.REMOVED);
        classJoiningRepository.save(joiningRecord);
    }

    @Override
    public void joinClass(String studentEmail, String classCode) {
        User learner = userRepository.findByEmail(studentEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Classroom classroom = classroomRepository.findByCode(classCode)
                .orElseThrow(() -> new AppException(ErrorCode.CLASSROOM_NOT_FOUND));

        var existingJoining = classJoiningRepository
                .findByClassroomIdAndLearnerId(classroom.getId(), learner.getId());

        if (existingJoining.isPresent()) {
            ClassJoining joining = existingJoining.get();
            if (joining.getStatus() == JoinStatus.REMOVED || joining.getStatus() == JoinStatus.REJECTED) {
                // Cho phép đăng ký lại nếu đã bị xóa hoặc bị từ chối trước đó
                joining.setStatus(classroom.getRequireApproval() != null && classroom.getRequireApproval()
                        ? JoinStatus.PENDING
                        : JoinStatus.APPROVED);
                joining.setJoinedAt(LocalDateTime.now());
                classJoiningRepository.save(joining);

                // Gửi thông báo như bình thường
                sendJoinNotification(classroom, learner, joining.getStatus());
                return;
            } else {
                throw new AppException(ErrorCode.USER_ALREADY_IN_CLASS);
            }
        }

        ClassJoining classJoining = ClassJoining.builder()
                .classroom(classroom)
                .learner(learner)
                .displayedName(learner.getFullName())
                .displayedPhone(learner.getPhone())
                .status(classroom.getRequireApproval() != null && classroom.getRequireApproval() ? JoinStatus.PENDING
                        : JoinStatus.APPROVED)
                .joinedAt(LocalDateTime.now())
                .build();

        classJoiningRepository.save(classJoining);
        sendJoinNotification(classroom, learner, classJoining.getStatus());
    }

    private void sendJoinNotification(Classroom classroom, User learner, JoinStatus status) {
        if (status == JoinStatus.PENDING) {
            notificationService.createNotification(
                    classroom.getCreator().getId(),
                    "Yêu cầu tham gia lớp học",
                    "Học sinh \"" + learner.getFullName() + "\" đang chờ bạn phê duyệt vào lớp \"" + classroom.getName()
                            + "\".",
                    NotificationType.JOIN_REQUEST,
                    "/teacher/classrooms/" + classroom.getId() + "/members");
        } else if (status == JoinStatus.APPROVED) {
            notificationService.createNotification(
                    classroom.getCreator().getId(),
                    "Thành viên mới",
                    "Học sinh \"" + learner.getFullName() + "\" vừa tham gia vào lớp \"" + classroom.getName() + "\".",
                    NotificationType.JOIN_APPROVED,
                    "/teacher/classrooms/" + classroom.getId() + "/members");
        }
    }

    @Override
    public void approveJoinRequest(Long joiningId, String teacherEmail) {
        ClassJoining joining = classJoiningRepository.findById(joiningId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_IN_CLASS));

        if (!joining.getClassroom().getCreator().getEmail().equals(teacherEmail)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        joining.setStatus(JoinStatus.APPROVED);
        classJoiningRepository.save(joining);

        // Thông báo cho học sinh
        notificationService.createNotification(
                joining.getLearner().getId(),
                "Yêu cầu được chấp nhận",
                "Yêu cầu tham gia lớp \"" + joining.getClassroom().getName()
                        + "\" của bạn đã được giáo viên phê duyệt.",
                NotificationType.JOIN_APPROVED,
                "/student/classrooms");
    }

    @Override
    public void rejectJoinRequest(Long joiningId, String teacherEmail) {
        ClassJoining joining = classJoiningRepository.findById(joiningId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_IN_CLASS));

        if (!joining.getClassroom().getCreator().getEmail().equals(teacherEmail)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        joining.setStatus(JoinStatus.REJECTED);
        classJoiningRepository.save(joining);

        // Thông báo cho học sinh
        notificationService.createNotification(
                joining.getLearner().getId(),
                "Yêu cầu bị từ chối",
                "Yêu cầu tham gia lớp \"" + joining.getClassroom().getName() + "\" của bạn đã bị từ chối.",
                NotificationType.JOIN_REJECTED,
                "/student/classrooms");
    }

    @Override
    @Transactional
    public ClassroomResponseDTO updateClassroom(Long classroomId, ClassroomRequestDTO request, String teacherEmail) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new AppException(ErrorCode.CLASSROOM_NOT_FOUND));

        if (!classroom.getCreator().getEmail().equals(teacherEmail)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        classroom.setName(request.getName());
        classroom.setDescription(request.getDescription());
        if (request.getRequireApproval() != null) {
            classroom.setRequireApproval(request.getRequireApproval());
        }
        if (request.getImageUrl() != null && !request.getImageUrl().isBlank()) {
            classroom.setImageUrl(request.getImageUrl());
        }

        classroomRepository.save(classroom);

        return ClassroomResponseDTO.builder()
                .id(classroom.getId())
                .name(classroom.getName())
                .description(classroom.getDescription())
                .code(classroom.getCode())
                .teacherName(classroom.getCreator().getFullName())
                .createdAt(classroom.getCreatedAt())
                .build();
    }

    @Override
    @Transactional
    public void deleteClassroom(Long classroomId, String teacherEmail) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new AppException(ErrorCode.CLASSROOM_NOT_FOUND));

        if (!classroom.getCreator().getEmail().equals(teacherEmail)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        classroomRepository.deleteById(classroomId);
    }

    @Override
    @Transactional
    public Map<String, Object> importStudentsFromExcel(Long classroomId, MultipartFile file, String teacherEmail) {
        User teacher = userRepository.findByEmail(teacherEmail)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new AppException(ErrorCode.CLASSROOM_NOT_FOUND));

        if (!classroom.getCreator().getId().equals(teacher.getId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        int successCount = 0;
        int failCount = 0;
        List<String> failedEmails = new ArrayList<>();
        List<String> alreadyJoinedEmails = new ArrayList<>();

        try (InputStream is = file.getInputStream();
                Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter(); // Bộ định dạng dữ liệu thông minh

            for (Row row : sheet) {
                if (row.getRowNum() == 0)
                    continue; // Bỏ qua dòng tiêu đề

                Cell cell = row.getCell(0);
                if (cell == null)
                    continue;

                // Đọc dữ liệu ô và chuyển về String bất kể định dạng là gì
                String email = formatter.formatCellValue(cell).trim();

                if (email.isEmpty())
                    continue;

                var studentOpt = userRepository.findByEmail(email);
                if (studentOpt.isEmpty()) {
                    failCount++;
                    failedEmails.add(email);
                    continue;
                }

                User learner = studentOpt.get();
                var existingJoining = classJoiningRepository
                        .findByClassroomIdAndLearnerId(classroom.getId(), learner.getId());

                if (existingJoining.isPresent()) {
                    ClassJoining joining = existingJoining.get();
                    if (joining.getStatus() == JoinStatus.APPROVED) {
                        alreadyJoinedEmails.add(email);
                        continue;
                    } else {
                        JoinStatus oldStatus = joining.getStatus();
                        // Nếu đang chờ duyệt (PENDING), đã bị xóa hoặc bị từ chối, giáo viên import lại
                        // thì cho vào luôn
                        joining.setStatus(JoinStatus.APPROVED);
                        joining.setJoinedAt(LocalDateTime.now());
                        classJoiningRepository.save(joining);
                        successCount++;

                        // Notify student
                        try {
                            String title = oldStatus == JoinStatus.PENDING ? "Yêu cầu tham gia lớp học được phê duyệt"
                                    : "Đã được thêm lại vào lớp học";
                            String content = oldStatus == JoinStatus.PENDING
                                    ? "Yêu cầu tham gia lớp \"" + classroom.getName() + "\" của bạn đã được phê duyệt."
                                    : "Giáo viên đã thêm bạn lại vào lớp \"" + classroom.getName() + "\".";

                            notificationService.createNotification(
                                    learner.getId(),
                                    title,
                                    content,
                                    NotificationType.JOIN_APPROVED,
                                    "/student/classrooms");
                        } catch (Exception e) {
                        }
                        continue;
                    }
                }

                ClassJoining classJoining = ClassJoining.builder()
                        .classroom(classroom)
                        .learner(learner)
                        .displayedName(learner.getFullName())
                        .displayedPhone(learner.getPhone())
                        .status(JoinStatus.APPROVED) // Auto approve when imported by teacher
                        .joinedAt(LocalDateTime.now())
                        .build();

                classJoiningRepository.save(classJoining);
                successCount++;

                // Notify student
                try {
                    notificationService.createNotification(
                            learner.getId(),
                            "Đã được thêm vào lớp học",
                            "Giáo viên đã thêm bạn vào lớp \"" + classroom.getName() + "\".",
                            NotificationType.JOIN_APPROVED,
                            "/student/classrooms");
                } catch (Exception e) {
                }
            }
        } catch (Exception e) {
            throw new AppException(ErrorCode.EXCEL_IMPORT_ERROR);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("successCount", successCount);
        result.put("failCount", failCount);
        result.put("failedEmails", failedEmails);
        result.put("alreadyJoinedEmails", alreadyJoinedEmails);
        return result;
    }

    @Override
    public AssignmentStatisticsDTO getAssignmentStatistics(Long assigningId, String teacherEmail) {
        com.example.quizhub.entity.QuizAssigning assigning = quizAssigningRepository.findByIdIncludingDeleted(assigningId)
                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_ASSIGNING_NOT_FOUND));

        if (!assigning.getClassroom().getCreator().getEmail().equals(teacherEmail)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        List<ClassJoining> members = classJoiningRepository.findByClassroomIdAndStatus(
                assigning.getClassroom().getId(), JoinStatus.APPROVED);

        String assignedIdsStr = assigning.getAssignedStudentIds();
        if (assignedIdsStr != null && !assignedIdsStr.trim().isEmpty()) {
            java.util.List<String> assignedIdsList = java.util.Arrays.asList(assignedIdsStr.split(","));
            members = members.stream()
                    .filter(cj -> assignedIdsList.contains(String.valueOf(cj.getLearner().getId())))
                    .collect(java.util.stream.Collectors.toList());
        }

        int totalStudents = members.size();
        int completedCount = 0;
        int inProgressCount = 0;
        int notStartedCount = 0;

        BigDecimal sum = BigDecimal.ZERO;
        BigDecimal highest = null;
        BigDecimal lowest = null;
        int scoresCount = 0;

        Map<String, Integer> distribution = new HashMap<>();
        distribution.put("0-2", 0);
        distribution.put("2-4", 0);
        distribution.put("4-6", 0);
        distribution.put("6-8", 0);
        distribution.put("8-10", 0);

        for (ClassJoining member : members) {
            Optional<QuizTaking> takingOpt = quizTakingRepository
                    .findByLearnerIdAndQuizAssigningId(member.getLearner().getId(), assigningId);

            if (takingOpt.isEmpty()) {
                notStartedCount++;
                continue;
            }

            QuizTaking taking = takingOpt.get();
            List<Attempt> attempts = attemptRepository.findByQuizTakingId(taking.getId());

            // Xác định trạng thái dựa trên các lượt làm
            boolean hasSubmitted = attempts.stream().anyMatch(att -> att.getEndedAt() != null);
            boolean hasInProgress = attempts.stream().anyMatch(att -> att.getEndedAt() == null);

            if (hasSubmitted) {
                completedCount++;
            } else if (hasInProgress) {
                inProgressCount++;
            } else {
                notStartedCount++;
            }

            // Find highest score for this student in this assignment
            BigDecimal studentBest = null;
            for (Attempt att : attempts) {
                if (att.getResult() != null) {
                    if (studentBest == null || att.getResult().compareTo(studentBest) > 0) {
                        studentBest = att.getResult();
                    }
                }
            }

            if (studentBest != null) {
                sum = sum.add(studentBest);
                scoresCount++;
                if (highest == null || studentBest.compareTo(highest) > 0)
                    highest = studentBest;
                if (lowest == null || studentBest.compareTo(lowest) < 0)
                    lowest = studentBest;

                double val = studentBest.doubleValue();
                if (val < 2)
                    distribution.put("0-2", distribution.get("0-2") + 1);
                else if (val < 4)
                    distribution.put("2-4", distribution.get("2-4") + 1);
                else if (val < 6)
                    distribution.put("4-6", distribution.get("4-6") + 1);
                else if (val < 8)
                    distribution.put("6-8", distribution.get("6-8") + 1);
                else
                    distribution.put("8-10", distribution.get("8-10") + 1);
            }
        }

        BigDecimal average = scoresCount > 0
                ? sum.divide(BigDecimal.valueOf(scoresCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return AssignmentStatisticsDTO.builder()
                .totalStudents(totalStudents)
                .completedCount(completedCount)
                .inProgressCount(inProgressCount)
                .notStartedCount(notStartedCount)
                .averageScore(average)
                .highestScore(highest != null ? highest : BigDecimal.ZERO)
                .lowestScore(lowest != null ? lowest : BigDecimal.ZERO)
                .scoreDistribution(distribution)
                .build();
    }
}

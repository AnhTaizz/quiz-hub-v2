package com.example.quizhub.service.quiz.impl;

import org.springframework.stereotype.Service;

import com.example.quizhub.dto.quizassigning.request.QuizAssigningRequestDTO;
import com.example.quizhub.dto.quizassigning.response.QuizAssigningResponseDTO;
import com.example.quizhub.entity.Classroom;
import com.example.quizhub.entity.Quiz;
import com.example.quizhub.entity.QuizAssigning;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.mapper.QuizAssigningMapper;
import com.example.quizhub.repository.ClassTopicRepository;
import com.example.quizhub.repository.ClassroomRepository;
import com.example.quizhub.repository.QuizAssigningRepository;
import com.example.quizhub.repository.QuizRepository;
import com.example.quizhub.service.NotificationService;
import com.example.quizhub.service.quiz.QuizAssigningService;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.entity.enums.NotificationType;
import com.example.quizhub.repository.ClassJoiningRepository;
import com.example.quizhub.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuizAssigningServiceImpl implements QuizAssigningService {
    private final QuizAssigningRepository quizAssigningRepository;
    private final QuizAssigningMapper quizAssigningMapper;
    private final ClassroomRepository classroomRepository;
    private final QuizRepository quizRepository;
    private final ClassTopicRepository classTopicRepository;
    private final ClassJoiningRepository classJoiningRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final com.example.quizhub.repository.AttemptRepository attemptRepository;

    private com.example.quizhub.entity.User getCurrentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public QuizAssigningResponseDTO create(QuizAssigningRequestDTO request) {
        com.example.quizhub.entity.User currentUser = getCurrentUser();
        Classroom classroom = classroomRepository.findById(request.getClassroomId())
                .orElseThrow(() -> new AppException(ErrorCode.CLASSROOM_NOT_FOUND));

        if (!classroom.getCreator().getId().equals(currentUser.getId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        Quiz quiz = quizRepository.findById(request.getQuizId())
                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_NOT_FOUND));

        if (!Boolean.TRUE.equals(quiz.getIsEnable())) {
            throw new AppException(ErrorCode.QUIZ_DISABLED);
        }

        if (!quiz.getCreator().getId().equals(currentUser.getId()) && Boolean.TRUE.equals(quiz.getIsDraft())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        QuizAssigning quizAssigning = quizAssigningMapper.toEntity(request);

        if (quizAssigning.getStartDate() == null) {
            quizAssigning.setStartDate(java.time.LocalDateTime.now());
        }
        if (quizAssigning.getDueDate() == null) {
            quizAssigning.setDueDate(java.time.LocalDateTime.now().plusDays(7));
        }

        // Validation logic
        // Allow a 1-minute buffer for "now" to account for execution delay
        if (quizAssigning.getDueDate().isBefore(java.time.LocalDateTime.now().minusMinutes(1))) {
            throw new AppException(ErrorCode.DEADLINE_IN_PAST);
        }

        if (quizAssigning.getDueDate().isBefore(quizAssigning.getStartDate()) ||
                quizAssigning.getDueDate().isEqual(quizAssigning.getStartDate())) {
            throw new AppException(ErrorCode.INVALID_DATE_RANGE);
        }

        if (quizAssigning.getDurationInMins() != null) {
            if (quizAssigning.getDurationInMins() <= 0) {
                throw new AppException(ErrorCode.INVALID_DURATION);
            }

            long windowMinutes = java.time.Duration.between(quizAssigning.getStartDate(), quizAssigning.getDueDate())
                    .toMinutes();
            if (quizAssigning.getDurationInMins() > windowMinutes) {
                throw new AppException(ErrorCode.INVALID_DURATION);
            }
        }
        if (quizAssigning.getMaxAttempt() == null || quizAssigning.getMaxAttempt() <= 0) {
            quizAssigning.setMaxAttempt(1);
        }
        if (quizAssigning.getQuestionShuffled() == null) {
            quizAssigning.setQuestionShuffled(false);
        }
        if (quizAssigning.getAnswerShuffled() == null) {
            quizAssigning.setAnswerShuffled(false);
        }
        if (quizAssigning.getShowAnswer() == null) {
            quizAssigning.setShowAnswer(true);
        }

        quizAssigning.setClassroom(classroom);
        quizAssigning.setQuiz(quiz);

        if (request.getTopicId() != null) {
            com.example.quizhub.entity.ClassTopic topic = classTopicRepository.findById(request.getTopicId())
                    .orElseThrow(() -> new AppException(ErrorCode.CLASS_TOPIC_NOT_FOUND));
            quizAssigning.setTopic(topic);
        }

        QuizAssigning savedQuizAssigning = quizAssigningRepository.save(quizAssigning);

        // Notify the teacher themselves for confirmation
        try {
            notificationService.createNotification(
                    classroom.getCreator().getId(),
                    "Đã giao bài kiểm tra",
                    "Bạn đã giao thành công bài kiểm tra \"" + quiz.getTitle() + "\" cho lớp " + classroom.getName(),
                    NotificationType.SYSTEM_ALERT,
                    "/teacher/classrooms/" + classroom.getId());
        } catch (Exception e) {
            log.error("Gửi thông báo xác nhận giao bài kiểm tra cho giáo viên thất bại: classroomId={}, quizId={}", classroom.getId(), quiz.getId(), e);
        }

        // Notify students in the classroom
        try {
            classJoiningRepository.findByClassroomIdAndStatus(classroom.getId(), JoinStatus.APPROVED)
                    .forEach(joining -> {
                        Long studentId = joining.getLearner().getId();
                        if (savedQuizAssigning.getAssignedStudentIds() == null || 
                            savedQuizAssigning.getAssignedStudentIds().isBlank() ||
                            java.util.Arrays.asList(savedQuizAssigning.getAssignedStudentIds().split(",")).contains(String.valueOf(studentId))) {
                            notificationService.createNotification(
                                    joining.getLearner().getId(),
                                    "Bài kiểm tra mới: " + quiz.getTitle(),
                                    "Bạn có bài kiểm tra mới trong lớp " + classroom.getName(),
                                    NotificationType.QUIZ_ASSIGNED,
                                    "/student/classrooms/" + classroom.getId());
                        }
                    });
        } catch (Exception e) {
            log.error("Gửi thông báo bài kiểm tra mới cho học sinh trong lớp thất bại: classroomId={}, quizId={}", classroom.getId(), quiz.getId(), e);
        }

        return quizAssigningMapper.toResponseDTO(savedQuizAssigning);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void delete(Long id) {
        com.example.quizhub.entity.User currentUser = getCurrentUser();
        QuizAssigning assigning = quizAssigningRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_ASSIGNING_NOT_FOUND));

        if (!assigning.getClassroom().getCreator().getId().equals(currentUser.getId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        if (attemptRepository.countByQuizAssigningId(id) > 0) {
            throw new AppException(ErrorCode.QUIZ_ASSIGNING_HAS_SUBMISSIONS);
        }

        quizAssigningRepository.delete(assigning);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void closeAssignment(Long id) {
        com.example.quizhub.entity.User currentUser = getCurrentUser();
        QuizAssigning assigning = quizAssigningRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_ASSIGNING_NOT_FOUND));

        if (!assigning.getClassroom().getCreator().getId().equals(currentUser.getId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        assigning.setDueDate(java.time.LocalDateTime.now());
        quizAssigningRepository.save(assigning);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void toggleHidden(Long id) {
        com.example.quizhub.entity.User currentUser = getCurrentUser();
        QuizAssigning assigning = quizAssigningRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_ASSIGNING_NOT_FOUND));

        if (!assigning.getClassroom().getCreator().getId().equals(currentUser.getId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        assigning.setIsHidden(assigning.getIsHidden() == null ? true : !assigning.getIsHidden());
        quizAssigningRepository.save(assigning);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void updateDeadline(Long id, java.time.LocalDateTime newDeadline) {
        com.example.quizhub.entity.User currentUser = getCurrentUser();
        QuizAssigning assigning = quizAssigningRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_ASSIGNING_NOT_FOUND));

        if (!assigning.getClassroom().getCreator().getId().equals(currentUser.getId())) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        if (newDeadline == null) {
            throw new AppException(ErrorCode.BLANK_FIELD);
        }

        if (newDeadline.equals(assigning.getDueDate())) {
            return;
        }

        // Allow a 1-minute buffer for "now" to account for execution delay
        if (newDeadline.isBefore(java.time.LocalDateTime.now().minusMinutes(1))) {
            throw new AppException(ErrorCode.DEADLINE_IN_PAST);
        }

        if (newDeadline.isBefore(assigning.getStartDate())) {
            throw new AppException(ErrorCode.INVALID_DATE_RANGE);
        }

        assigning.setDueDate(newDeadline);
        quizAssigningRepository.save(assigning);
    }
}

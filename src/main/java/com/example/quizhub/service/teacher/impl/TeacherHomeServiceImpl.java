package com.example.quizhub.service.teacher.impl;

import com.example.quizhub.dto.teacher.response.TeacherDashboardAssignmentDTO;
import com.example.quizhub.dto.teacher.response.TeacherHomeDashboardDTO;
import com.example.quizhub.entity.User;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.teacher.TeacherHomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeacherHomeServiceImpl implements TeacherHomeService {

    private final UserRepository userRepository;
    private final ClassroomRepository classroomRepository;
    private final QuestionRepository questionRepository;
    private final QuizAssigningRepository quizAssigningRepository;
    private final AttemptViolationRepository attemptViolationRepository;
    private final ClassJoiningRepository classJoiningRepository;

    @Override
    public TeacherHomeDashboardDTO getDashboardData(String email) {
        User teacher = userRepository.findByEmail(email).orElseThrow();

        long classroomCount = classroomRepository.countByCreatorId(teacher.getId());
        long questionCount = questionRepository.countByCreatorId(teacher.getId());
        long studentCount = classJoiningRepository.countDistinctLearnersByTeacherId(teacher.getId());

        List<TeacherDashboardAssignmentDTO> assignments = quizAssigningRepository.findByClassroomCreatorId(teacher.getId()).stream()
                .map(qa -> {
                    String status = "UPCOMING";
                    LocalDateTime now = LocalDateTime.now();
                    if (now.isAfter(qa.getStartDate()) && now.isBefore(qa.getDueDate())) status = "LIVE";
                    else if (now.isAfter(qa.getDueDate())) status = "ENDED";

                    return TeacherDashboardAssignmentDTO.builder()
                            .assigningId(qa.getId())
                            .classroomName(qa.getClassroom().getName())
                            .quizTitle(qa.getQuiz().getTitle())
                            .violationCount(attemptViolationRepository.countByAssigningId(qa.getId()))
                            .status(status)
                            .build();
                })
                .collect(Collectors.toList());

        long liveQuizCount = assignments.stream().filter(as -> "LIVE".equals(as.getStatus())).count();

        return TeacherHomeDashboardDTO.builder()
                .classroomCount(classroomCount)
                .questionCount(questionCount)
                .studentCount(studentCount)
                .assignments(assignments)
                .liveQuizCount(liveQuizCount)
                .currentUser(teacher)
                .build();
    }
}

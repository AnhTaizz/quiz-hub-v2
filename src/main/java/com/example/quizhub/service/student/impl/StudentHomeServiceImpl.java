package com.example.quizhub.service.student.impl;

import com.example.quizhub.dto.student.QuizDashboardInfoDTO;
import com.example.quizhub.dto.student.StudentHomeDashboardDTO;
import com.example.quizhub.entity.*;
import com.example.quizhub.entity.enums.JoinStatus;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.student.StudentHomeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentHomeServiceImpl implements StudentHomeService {

    private final AttemptRepository attemptRepository;
    private final PracticeRepository practiceRepository;
    private final QuizTakingRepository quizTakingRepository;
    private final UserRepository userRepository;
    private final ClassJoiningRepository classJoiningRepository;
    private final QuizAssigningRepository quizAssigningRepository;

    private boolean isStudentAllowed(QuizAssigning a, Long studentId) {
        String ids = a.getAssignedStudentIds();
        if (ids == null || ids.isBlank())
            return true;
        return Arrays.asList(ids.split(",")).contains(String.valueOf(studentId));
    }

    @Override
    public User getStudentByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    @Override
    public StudentHomeDashboardDTO getDashboardData(String email) {
        User student = userRepository.findByEmail(email).orElse(null);
        if (student == null) {
            return null;
        }

        List<Attempt> allCompletedAttempts = attemptRepository
                .findByQuizTakingLearnerIdAndEndedAtIsNotNull(student.getId());
        List<Attempt> classroomAttempts = allCompletedAttempts.stream()
                .filter(a -> a.getQuizTaking() != null && a.getQuizTaking().getQuizAssigning() != null)
                .collect(Collectors.toList());

        long attemptCount = classroomAttempts.size();
        long practiceCount = practiceRepository.countByUserIdAndIsCompletedTrue(student.getId());
        long totalCompleted = attemptCount + practiceCount;

        List<Practice> completedPractices = practiceRepository
                .findByUserIdAndIsCompletedTrueOrderByCreatedAtDesc(student.getId());

        BigDecimal quizAvg = BigDecimal.ZERO;
        if (!classroomAttempts.isEmpty()) {
            BigDecimal sum = classroomAttempts.stream()
                    .map(a -> a.getResult() != null ? a.getResult() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            quizAvg = sum.divide(BigDecimal.valueOf(classroomAttempts.size()), 1, RoundingMode.HALF_UP);
        }

        BigDecimal practiceAvg = BigDecimal.ZERO;
        if (!completedPractices.isEmpty()) {
            BigDecimal sum = completedPractices.stream()
                    .map(p -> {
                        if (p.getTotalQuestions() != null && p.getTotalQuestions() > 0) {
                            double calc = (p.getCorrectAnswers() * 10.0) / p.getTotalQuestions();
                            return BigDecimal.valueOf(calc);
                        }
                        return BigDecimal.ZERO;
                    })
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            practiceAvg = sum.divide(BigDecimal.valueOf(completedPractices.size()), 1, RoundingMode.HALF_UP);
        }

        List<ClassJoining> joinedClasses = classJoiningRepository.findByLearnerIdAndStatusIn(
                student.getId(),
                List.of(JoinStatus.APPROVED, JoinStatus.PENDING)).stream().filter(j -> j.getClassroom() != null)
                .collect(Collectors.toList());
        List<QuizAssigning> rawAssignedQuizzes = new ArrayList<>();
        for (ClassJoining joining : joinedClasses) {
            if (joining.getStatus() == JoinStatus.APPROVED && joining.getClassroom() != null) {
                rawAssignedQuizzes
                        .addAll(quizAssigningRepository.findByClassroomId(joining.getClassroom().getId()));
            }
        }

        List<QuizDashboardInfoDTO> dashboardQuizzes = new ArrayList<>();
        int pendingThisWeekCount = 0;
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime nextWeek = now.plusDays(7);

        for (QuizAssigning assigning : rawAssignedQuizzes) {
            if (Boolean.TRUE.equals(assigning.getIsHidden()) || !isStudentAllowed(assigning, student.getId())) {
                continue;
            }

            QuizTaking taking = quizTakingRepository
                    .findByLearnerIdAndQuizAssigningId(student.getId(), assigning.getId())
                    .orElse(null);

            int finishedCount = 0;
            boolean anyAttemptExists = false;
            boolean hasUnfinished = false;
            if (taking != null) {
                List<Attempt> attempts = attemptRepository.findByQuizTakingId(taking.getId());
                finishedCount = (int) attempts.stream().filter(a -> a.getEndedAt() != null).count();
                anyAttemptExists = !attempts.isEmpty();
                hasUnfinished = attempts.stream().anyMatch(a -> a.getEndedAt() == null);
            }

            int max = assigning.getMaxAttempt() != null ? assigning.getMaxAttempt() : 0;
            boolean hasAttemptsLeft = (max == 0) || (finishedCount < max);

            boolean isExpired = assigning.getDueDate() != null && now.isAfter(assigning.getDueDate());
            boolean isUpcoming = assigning.getStartDate() != null && now.isBefore(assigning.getStartDate());

            if (hasAttemptsLeft && !isExpired && !isUpcoming) {
                QuizDashboardInfoDTO info = new QuizDashboardInfoDTO();
                info.setAssigning(assigning);
                info.setAttemptsMade(finishedCount);
                info.setAttemptsLeft(max == 0 ? -1 : (max - finishedCount));
                info.setHasStarted(anyAttemptExists);
                info.setHasUnfinished(hasUnfinished);
                dashboardQuizzes.add(info);

                if (assigning.getDueDate() != null && assigning.getDueDate().isBefore(nextWeek)) {
                    pendingThisWeekCount++;
                }
            }
        }

        return StudentHomeDashboardDTO.builder()
                .totalCompleted(totalCompleted)
                .quizAvg(quizAvg)
                .practiceAvg(practiceAvg)
                .assignedQuizzes(dashboardQuizzes)
                .pendingCount(dashboardQuizzes.size())
                .pendingThisWeekCount(pendingThisWeekCount)
                .build();
    }

    @Override
    public List<QuizDashboardInfoDTO> getAllQuizzes(String email) {
        User student = userRepository.findByEmail(email).orElse(null);
        if (student == null) {
            return new ArrayList<>();
        }

        List<ClassJoining> joinedClasses = classJoiningRepository.findByLearnerIdAndStatusIn(
                student.getId(),
                List.of(JoinStatus.APPROVED, JoinStatus.PENDING)).stream().filter(j -> j.getClassroom() != null)
                .collect(Collectors.toList());

        Map<Long, QuizDashboardInfoDTO> quizMap = new LinkedHashMap<>();

        for (ClassJoining joining : joinedClasses) {
            if (joining.getStatus() == JoinStatus.APPROVED && joining.getClassroom() != null) {
                Long classId = joining.getClassroom().getId();
                List<QuizAssigning> classroomQuizzes = quizAssigningRepository.findByClassroomId(classId);

                if (classroomQuizzes != null) {
                    for (QuizAssigning assigning : classroomQuizzes) {
                        if (assigning == null || assigning.getQuiz() == null
                                || Boolean.TRUE.equals(assigning.getIsHidden())
                                || !isStudentAllowed(assigning, student.getId()))
                            continue;

                        if (quizMap.containsKey(assigning.getId()))
                            continue;

                        QuizTaking taking = quizTakingRepository
                                .findByLearnerIdAndQuizAssigningId(student.getId(), assigning.getId())
                                .orElse(null);

                        int finishedCount = 0;
                        boolean anyAttemptExists = false;
                        boolean hasUnfinished = false;
                        if (taking != null) {
                            List<Attempt> attempts = attemptRepository.findByQuizTakingId(taking.getId());
                            if (attempts != null) {
                                finishedCount = (int) attempts.stream().filter(a -> a.getEndedAt() != null).count();
                                anyAttemptExists = !attempts.isEmpty();
                                hasUnfinished = attempts.stream().anyMatch(a -> a.getEndedAt() == null);
                            }
                        }

                        QuizDashboardInfoDTO info = new QuizDashboardInfoDTO();
                        info.setAssigning(assigning);
                        info.setAttemptsMade(finishedCount);
                        info.setAttemptsLeft(
                                assigning.getMaxAttempt() == null || assigning.getMaxAttempt() == 0 ? -1
                                        : Math.max(0, assigning.getMaxAttempt() - finishedCount));
                        info.setHasStarted(anyAttemptExists);
                        info.setHasUnfinished(hasUnfinished);

                        quizMap.put(assigning.getId(), info);
                    }
                }
            }
        }

        List<QuizDashboardInfoDTO> allQuizzes = new ArrayList<>(quizMap.values());

        allQuizzes.sort((a, b) -> {
            LocalDateTime d1 = a.getAssigning().getDueDate();
            LocalDateTime d2 = b.getAssigning().getDueDate();
            if (d1 == null && d2 == null)
                return 0;
            if (d1 == null)
                return 1;
            if (d2 == null)
                return -1;
            return d1.compareTo(d2);
        });

        return allQuizzes;
    }

    @Override
    public List<ClassJoining> getApprovedClasses(String email) {
        User student = userRepository.findByEmail(email).orElse(null);
        if (student == null) {
            return new ArrayList<>();
        }
        return classJoiningRepository.findByLearnerIdAndStatusIn(
                student.getId(),
                List.of(JoinStatus.APPROVED, JoinStatus.PENDING))
                .stream()
                .filter(j -> j.getClassroom() != null && j.getStatus() == JoinStatus.APPROVED)
                .collect(Collectors.toList());
    }

    @Override
    public QuizAssigning getQuizAssigningById(Long assigningId) {
        return quizAssigningRepository.findByIdIncludingDeleted(assigningId).orElseThrow();
    }

    @Override
    public List<Attempt> getQuizHistory(Long assigningId, String email) {
        User student = userRepository.findByEmail(email).orElseThrow();
        QuizTaking taking = quizTakingRepository.findByLearnerIdAndQuizAssigningId(student.getId(), assigningId)
                .orElse(null);

        if (taking != null) {
            return attemptRepository.findByQuizTakingIdOrderByStartedAtDesc(taking.getId());
        }
        return new ArrayList<>();
    }

    @Override
    public List<Attempt> getAllQuizAttempts(String email) {
        User student = userRepository.findByEmail(email).orElseThrow();
        return attemptRepository.findByQuizTakingLearnerIdOrderByStartedAtDesc(student.getId());
    }
}

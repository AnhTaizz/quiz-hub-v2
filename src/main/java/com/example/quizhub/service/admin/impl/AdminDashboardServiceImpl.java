package com.example.quizhub.service.admin.impl;

import com.example.quizhub.dto.admin.response.AdminDashboardDetailsResponse;
import com.example.quizhub.dto.admin.response.AdminDashboardStatsResponse;
import com.example.quizhub.dto.admin.response.AdminReportStatsResponse;
import com.example.quizhub.dto.admin.response.RecentAttemptResponse;
import com.example.quizhub.entity.enums.QuestionStatus;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.repository.*;
import com.example.quizhub.service.admin.AdminDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminDashboardServiceImpl implements AdminDashboardService {

        private final UserRepository userRepository;
        private final CategoryRepository categoryRepository;
        private final QuestionRepository questionRepository;
        private final AttemptRepository attemptRepository;
        private final QuizRepository quizRepository;
        private final PracticeRepository practiceRepository;

        @Override
        public AdminDashboardStatsResponse getStats() {
                long totalUsers = userRepository.count();
                long totalPublicCategories = categoryRepository.countByIsPublicTrue();
                long pendingQuestions = questionRepository.countByQuestionStatus(QuestionStatus.PENDING);
                long totalQuestions = questionRepository.count();

                return new AdminDashboardStatsResponse(totalUsers, totalPublicCategories, pendingQuestions,
                                totalQuestions);
        }

        @Override
        public AdminReportStatsResponse getReportStats() {
                return AdminReportStatsResponse.builder()
                                .studentCount(userRepository.countByRole(Role.STUDENT))
                                .teacherCount(userRepository.countByRole(Role.TEACHER))
                                .adminCount(userRepository.countByRole(Role.ADMIN))
                                .approvedQuestions(questionRepository.countByQuestionStatus(QuestionStatus.PUBLIC))
                                .pendingQuestions(questionRepository.countByQuestionStatus(QuestionStatus.PENDING))
                                .privateQuestions(questionRepository.countByQuestionStatus(QuestionStatus.PRIVATE))
                                .scoreLow(attemptRepository
                                                .countByResultLessThanAndEndedAtIsNotNull(new BigDecimal("5.0")))
                                .scoreMedium(attemptRepository.countByResultBetweenAndEndedAtIsNotNull(
                                                new BigDecimal("5.0"), new BigDecimal("8.0")))
                                .scoreHigh(attemptRepository.countByResultGreaterThanEqualAndEndedAtIsNotNull(
                                                new BigDecimal("8.0")))
                                .recentAttempts(getCombinedRecentActivity())
                                .build();
        }

        private List<RecentAttemptResponse> getCombinedRecentActivity() {
                List<RecentAttemptResponse> activities = new ArrayList<>();

                attemptRepository.findTop10ByEndedAtIsNotNullOrderByStartedAtDesc().forEach(attempt -> {
                        activities.add(RecentAttemptResponse.builder()
                                        .id(attempt.getId())
                                        .studentName(attempt.getQuizTaking().getLearner().getFullName())
                                        .quizTitle(attempt.getQuizTaking().getQuiz().getTitle())
                                        .score(attempt.getResult())
                                        .startedAt(attempt.getStartedAt())
                                        .type("QUIZ")
                                        .build());
                });

                practiceRepository.findTop10ByIsCompletedTrueOrderByCreatedAtDesc().forEach(p -> {
                        BigDecimal score = BigDecimal.ZERO;
                        if (p.getTotalQuestions() != null && p.getTotalQuestions() > 0) {
                                double calc = (p.getCorrectAnswers() * 10.0) / p.getTotalQuestions();
                                score = BigDecimal.valueOf(calc).setScale(1, java.math.RoundingMode.HALF_UP);
                        }

                        activities.add(RecentAttemptResponse.builder()
                                        .id(p.getId())
                                        .studentName(p.getUser().getFullName())
                                        .quizTitle("Luyện tập: "
                                                        + (p.getCategory() != null ? p.getCategory().getName() : "N/A"))
                                        .score(score)
                                        .startedAt(p.getCreatedAt())
                                        .type("PRACTICE")
                                        .build());
                });

                return activities.stream()
                                .sorted(Comparator.comparing(RecentAttemptResponse::getStartedAt).reversed())
                                .limit(10)
                                .collect(Collectors.toList());
        }

        @Override
        public AdminDashboardDetailsResponse getDashboardDetails() {
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");

                return AdminDashboardDetailsResponse.builder()
                                .recentUsers(userRepository.findTop5ByOrderByCreatedAtDesc().stream()
                                                .map(u -> AdminDashboardDetailsResponse.DashboardUserResponse.builder()
                                                                .fullName(u.getFullName())
                                                                .email(u.getEmail())
                                                                .role(u.getRole().name())
                                                                .createdAt(u.getCreatedAt() != null
                                                                                ? u.getCreatedAt().format(formatter)
                                                                                : "N/A")
                                                                .build())
                                                .collect(Collectors.toList()))
                                .pendingModeration(questionRepository
                                                .findTop5ByQuestionStatusOrderByIdDesc(QuestionStatus.PENDING).stream()
                                                .map(q -> AdminDashboardDetailsResponse.DashboardModerationResponse
                                                                .builder()
                                                                .id(q.getId())
                                                                .text(q.getText())
                                                                .type("Câu hỏi")
                                                                .creatorName(q.getCreator() != null
                                                                                ? q.getCreator().getFullName()
                                                                                : "N/A")
                                                                .categoryName(q.getCategory() != null
                                                                                ? q.getCategory().getName()
                                                                                : "N/A")
                                                                .build())
                                                .collect(Collectors.toList()))
                                .categories(categoryRepository.findTop5ByIsPublicTrueOrderByIdDesc().stream()
                                                .map(c -> AdminDashboardDetailsResponse.DashboardCategoryResponse
                                                                .builder()
                                                                .id(c.getId())
                                                                .name(c.getName())
                                                                .quizCount(quizRepository.countByCategoryId(c.getId()))
                                                                .questionCount(questionRepository
                                                                                .countByCategoryId(c.getId()))
                                                                .build())
                                                .collect(Collectors.toList()))
                                .build();
        }
}

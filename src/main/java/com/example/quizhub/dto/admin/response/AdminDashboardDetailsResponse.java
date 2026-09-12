package com.example.quizhub.dto.admin.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminDashboardDetailsResponse {
    private List<DashboardUserResponse> recentUsers;
    private List<DashboardModerationResponse> pendingModeration;
    private List<DashboardCategoryResponse> categories;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DashboardUserResponse {
        private String fullName;
        private String email;
        private String role;
        private String createdAt; // Formatted date
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DashboardModerationResponse {
        private Long id;
        private String text;
        private String type; // Question or Quiz
        private String creatorName;
        private String categoryName;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DashboardCategoryResponse {
        private Long id;
        private String name;
        private long quizCount;
        private long questionCount;
    }
}

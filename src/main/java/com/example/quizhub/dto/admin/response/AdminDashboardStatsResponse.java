package com.example.quizhub.dto.admin.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminDashboardStatsResponse {
    private long totalUsers;
    private long totalPublicCategories;
    private long pendingQuestions;
    private long totalQuestions;
}

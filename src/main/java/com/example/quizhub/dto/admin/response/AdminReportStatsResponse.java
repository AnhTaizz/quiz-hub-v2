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
public class AdminReportStatsResponse {
    // User Distribution
    private long studentCount;
    private long teacherCount;
    private long adminCount;

    // Question Status
    private long approvedQuestions;
    private long pendingQuestions;
    private long privateQuestions;

    // Score Distribution
    private long scoreLow;    // < 5
    private long scoreMedium; // 5 - 8
    private long scoreHigh;   // > 8

    // Recent Activity
    private List<RecentAttemptResponse> recentAttempts;
}

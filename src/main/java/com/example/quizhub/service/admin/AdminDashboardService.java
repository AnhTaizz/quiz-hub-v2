package com.example.quizhub.service.admin;

import com.example.quizhub.dto.admin.response.AdminDashboardDetailsResponse;
import com.example.quizhub.dto.admin.response.AdminDashboardStatsResponse;
import com.example.quizhub.dto.admin.response.AdminReportStatsResponse;

public interface AdminDashboardService {
    AdminDashboardStatsResponse getStats();
    AdminReportStatsResponse getReportStats();
    AdminDashboardDetailsResponse getDashboardDetails();
}

package com.example.quizhub.controller.admin.rest;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.admin.response.AdminDashboardStatsResponse;
import com.example.quizhub.dto.admin.response.AdminReportStatsResponse;
import com.example.quizhub.dto.admin.response.AdminDashboardDetailsResponse;
import com.example.quizhub.service.admin.AdminDashboardService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {
    private final AdminDashboardService adminDashboardService;

    @GetMapping("/stats")
    public ResponseEntity<AdminDashboardStatsResponse> getStats() {
        return ResponseEntity.ok(adminDashboardService.getStats());
    }

    @GetMapping("/reports")
    public ResponseEntity<AdminReportStatsResponse> getReportStats() {
        return ResponseEntity.ok(adminDashboardService.getReportStats());
    }

    @GetMapping("/details")
    public ResponseEntity<AdminDashboardDetailsResponse> getDashboardDetails() {
        return ResponseEntity.ok(adminDashboardService.getDashboardDetails());
    }
}

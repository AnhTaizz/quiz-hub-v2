package com.example.quizhub.dto.quiztaking.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ViolationResponseDTO {
    /** Tổng số vi phạm của lần thi này tính đến hiện tại */
    private long violationCount;

    /**
     * true nếu hệ thống đã tự động nộp bài vì vượt ngưỡng vi phạm.
     * Frontend sẽ redirect học sinh về trang kết quả khi nhận được flag này.
     */
    private boolean autoSubmitted;

    /** attemptId – dùng để redirect về trang kết quả khi autoSubmitted = true */
    private Long attemptId;
}

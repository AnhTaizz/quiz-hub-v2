package com.example.quizhub.dto.classroom.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentStatisticsDTO {
    int totalStudents;
    int completedCount;
    int inProgressCount;
    int notStartedCount;
    
    BigDecimal averageScore;
    BigDecimal highestScore;
    BigDecimal lowestScore;
    
    // Score range distribution: "0-2", "2-4", "4-6", "6-8", "8-10"
    Map<String, Integer> scoreDistribution;
}

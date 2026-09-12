package com.example.quizhub.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "exam_violation")
public class ExamViolation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    // Mã vi phạm duy nhất, VD: 'TAB_SWITCH', 'ESC_FULLSCREEN'
    @Column(name = "violation_code", nullable = false, unique = true, length = 50)
    String violationCode;

    // Mức độ vi phạm: 1 = Nhẹ, 2 = Cảnh cáo, 3 = Nặng
    @Column(name = "severity_level", columnDefinition = "int default 1")
    Integer severityLevel;

    @Column(columnDefinition = "TEXT")
    String description;
}

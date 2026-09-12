package com.example.quizhub.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "attempt_violations")
public class AttemptViolation {

    /**
     * Dùng UUID làm khoá chính (tương đương VARCHAR(36) trong SQL gốc).
     */
    @Id
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id")
    Attempt attempt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "violation_type_id")
    ExamViolation violationType;

    @Column(name = "occurred_at")
    LocalDateTime occurredAt;
}

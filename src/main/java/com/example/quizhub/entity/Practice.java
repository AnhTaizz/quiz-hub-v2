package com.example.quizhub.entity;

import java.time.LocalDateTime;
import java.util.List;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
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
@Table(name = "_practice")
public class Practice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = true)
    Category category;

    @Column(name = "total_questions", nullable = false)
    Integer totalQuestions;

    @Column(name = "correct_answers", nullable = false)
    @Builder.Default
    Integer correctAnswers = 0;

    @CreationTimestamp
    @Column(name = "created_at")
    LocalDateTime createdAt;

    @Column(name = "practice_limit")
    Integer practiceLimit;

    @Column(name = "practice_offset")
    Integer practiceOffset;

    @Column(name = "is_completed")
    @Builder.Default
    Boolean isCompleted = false;

    @Column(name = "is_random")
    @Builder.Default
    Boolean isRandom = false;

    @OneToMany(mappedBy = "practice", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    List<PracticeDetail> details;
}

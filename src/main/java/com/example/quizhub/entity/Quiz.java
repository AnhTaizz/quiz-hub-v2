package com.example.quizhub.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "_quiz")
public class Quiz {

    /**
     * Dùng UUID làm khoá chính, lưu dạng BINARY(16) trong MySQL / uuid trong PostgreSQL.
     * @UuidGenerator thay thế @GeneratedValue để Hibernate tự sinh UUID.
     */
    @Id
    @UuidGenerator
    @Column(updatable = false, nullable = false)
    UUID id;

    @Column(length = 255)
    String title;

    @Column(length = 1000)
    String description;

    @Column(name = "image_url", columnDefinition = "TEXT")
    String imageUrl;

    @Column(name = "is_draft", nullable = false)
    Boolean isDraft;

    @Column(name = "is_enable", nullable = false)
    Boolean isEnable;

    @Column(name = "is_exam", nullable = false)
    Boolean isExam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_id", nullable = false)
    User creator;

    @CreationTimestamp
    @Column(name = "created_at")
    LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")  //Cho phép category null
    Category category;

    @ManyToMany
    @JoinTable(
        name = "_question_creating",
        joinColumns = @JoinColumn(name = "quiz_id"),
        inverseJoinColumns = @JoinColumn(name = "quest_id")
    )
    @BatchSize(size = 30)
    List<Question> questions;
}

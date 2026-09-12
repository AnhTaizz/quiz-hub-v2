package com.example.quizhub.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.Where;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
@Table(name = "_classroom")
@SQLDelete(sql = "UPDATE _classroom SET is_deleted = true WHERE id = ?")
@Where(clause = "is_deleted = false")
public class Classroom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(nullable = false, unique = true, length = 8)
    String code;

    @Column(nullable = false, length = 64)
    String name;

    @Column(name = "is_enable", nullable = false)
    Boolean isEnable;

    @Column(length = 128)
    String description;

    @Column(name = "imageurl", columnDefinition = "TEXT")
    String imageUrl;

    @Column(name = "is_draft")
    Boolean isDraft;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_id", referencedColumnName = "id")
    User creator;

    @Column(name = "require_approval")
    Boolean requireApproval;

    @CreationTimestamp
    @Column(name = "created_at")
    LocalDateTime createdAt;

    @Column(name = "is_deleted", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    Boolean isDeleted = false;
}

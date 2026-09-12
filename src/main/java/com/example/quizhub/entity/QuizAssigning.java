package com.example.quizhub.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;
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
@Table(name = "_quiz_assigning")
@SQLDelete(sql = "UPDATE _quiz_assigning SET is_deleted = true WHERE id = ?")
@Where(clause = "is_deleted = false")
public class QuizAssigning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(length = 255)
    String note;

    @Column(name = "max_attempt")
    Integer maxAttempt;

    @Column(name = "question_shuffled")
    Boolean questionShuffled;

    @Column(name = "answer_shuffled")
    Boolean answerShuffled;

    @Column(name = "show_answer")
    Boolean showAnswer;

    @Column(name = "duration_in_mins")
    Integer durationInMins;

    @Column(name = "start_date")
    LocalDateTime startDate;

    @Column(name = "due_date")
    LocalDateTime dueDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classroom_id")
    @NotFound(action = NotFoundAction.IGNORE)
    Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "quiz_id")
    Quiz quiz;

    @CreationTimestamp
    @Column(name = "created_at")
    LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topic_id")
    private ClassTopic topic; // Có thể null nếu giáo viên không muốn gom vào topic nào

    @Column(name = "is_deleted", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    Boolean isDeleted = false;

    @Column(name = "is_hidden", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    Boolean isHidden = false;

    @Column(name = "assigned_student_ids", columnDefinition = "TEXT")
    String assignedStudentIds;
}

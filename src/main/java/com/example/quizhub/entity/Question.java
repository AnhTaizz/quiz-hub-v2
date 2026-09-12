package com.example.quizhub.entity;

import java.util.List;

import org.hibernate.annotations.BatchSize;

import com.example.quizhub.entity.enums.QuestionLevel;
import com.example.quizhub.entity.enums.QuestionStatus;
import com.example.quizhub.entity.enums.QuestionType;
    
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "_question")
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    QuestionType type;

    @Column(nullable = false, columnDefinition = "TEXT")
    String text;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_id")
    User creator;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    Category category;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status")
    @Builder.Default
    private QuestionStatus questionStatus = QuestionStatus.PRIVATE;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_level")
    @Builder.Default
    private QuestionLevel level = QuestionLevel.MEDIUM;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 20)
    List<Answer> answers;
}

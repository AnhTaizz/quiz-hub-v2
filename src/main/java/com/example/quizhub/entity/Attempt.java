package com.example.quizhub.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "_attempt")
public class Attempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(precision = 5, scale = 2)
    BigDecimal result;

    @Column(name = "total_quest_num")
    Integer totalQuestNum;

    @Column(name = "correct_num")
    Integer correctNum;

    @Column(name = "incorrect_num")
    Integer incorrectNum;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "taking_id")
    QuizTaking quizTaking;

    @Column(name = "started_at")
    LocalDateTime startedAt;

    @Column(name = "ended_at")
    LocalDateTime endedAt;
}

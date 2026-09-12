package com.example.quizhub.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

import org.hibernate.annotations.NotFound;
import org.hibernate.annotations.NotFoundAction;

import com.example.quizhub.entity.enums.JoinStatus;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
@Entity
@Table(name = "_class_joining")
public class ClassJoining {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "_displayed_name", length = 255)
    String displayedName;

    @Column(name = "_displayed_phone", length = 255)
    String displayedPhone;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "class_id")
    @NotFound(action = NotFoundAction.IGNORE)
    Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "learner_id")
    User learner;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    JoinStatus status;

    @Column(name = "joined_at")
    LocalDateTime joinedAt;
}

package com.example.quizhub.repository;

import com.example.quizhub.entity.AttemptViolation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AttemptViolationRepository extends JpaRepository<AttemptViolation, UUID> {

    List<AttemptViolation> findByAttemptId(Long attemptId);

    long countByAttemptId(Long attemptId);

    @Query("SELECT COUNT(v) FROM AttemptViolation v WHERE v.attempt.quizTaking.quizAssigning.id = :assigningId")
    long countByAssigningId(Long assigningId);

    @Query("SELECT v FROM AttemptViolation v WHERE v.attempt.quizTaking.quizAssigning.id = :assigningId ORDER BY v.occurredAt DESC")
    List<AttemptViolation> findAllByAssigningId(Long assigningId);
}

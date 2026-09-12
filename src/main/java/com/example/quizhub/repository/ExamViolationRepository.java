package com.example.quizhub.repository;

import com.example.quizhub.entity.ExamViolation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ExamViolationRepository extends JpaRepository<ExamViolation, Integer> {

    Optional<ExamViolation> findByViolationCode(String violationCode);
}

package com.example.quizhub.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.quizhub.entity.PracticeDetail;

@Repository
public interface PracticeDetailRepository extends JpaRepository<PracticeDetail, Long> {
    Optional<PracticeDetail> findFirstByPracticeIdAndQuestionIdOrderByIdAsc(Long practiceId, Long questionId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(pd) FROM PracticeDetail pd WHERE pd.practice.id = :practiceId AND (pd.selectedAnswers IS NOT EMPTY OR pd.selectedText IS NOT NULL)")
    long countAnsweredByPracticeId(Long practiceId);
}

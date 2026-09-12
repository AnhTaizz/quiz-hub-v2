package com.example.quizhub.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.quizhub.entity.Practice;

@Repository
public interface PracticeRepository extends JpaRepository<Practice, Long> {
    List<Practice> findByCategoryId(Long categoryId);

    List<Practice> findByUserIdAndCategoryIdOrderByCreatedAtDesc(Long userId, Long categoryId);

    List<Practice> findTop10ByOrderByCreatedAtDesc();
    List<Practice> findTop10ByIsCompletedTrueOrderByCreatedAtDesc();

    long countByUserId(Long userId);

    long countByUserIdAndIsCompletedTrue(Long userId);

    List<Practice> findByUserId(Long userId);

    List<Practice> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<Practice> findFirstByUserIdAndCategoryIdAndPracticeLimitAndPracticeOffsetAndIsRandomAndIsCompletedFalseOrderByCreatedAtDesc(
            Long userId, Long categoryId, Integer practiceLimit, Integer practiceOffset, Boolean isRandom);

    Optional<Practice> findFirstByUserIdAndCategoryIdAndIsRandomAndIsCompletedFalseOrderByCreatedAtDesc(
            Long userId, Long categoryId, Boolean isRandom);

    List<Practice> findByUserIdAndCategoryIdAndIsCompletedTrueOrderByCreatedAtDesc(Long userId, Long categoryId);

    List<Practice> findByUserIdAndIsCompletedTrueOrderByCreatedAtDesc(Long userId);
}

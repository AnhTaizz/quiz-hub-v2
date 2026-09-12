package com.example.quizhub.repository;

import com.example.quizhub.entity.Attempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AttemptRepository extends JpaRepository<Attempt, Long> {

    List<Attempt> findByQuizTakingId(Long quizTakingId);
    List<Attempt> findByQuizTakingIdOrderByStartedAtDesc(Long quizTakingId);
    int countByQuizTakingId(Long quizTakingId);

    long countByResultLessThanAndEndedAtIsNotNull(BigDecimal score);
    long countByResultBetweenAndEndedAtIsNotNull(BigDecimal min, BigDecimal max);
    long countByResultGreaterThanEqualAndEndedAtIsNotNull(BigDecimal score);

    List<Attempt> findTop10ByEndedAtIsNotNullOrderByStartedAtDesc();

    long countByQuizTakingLearnerId(Long learnerId);
    long countByQuizTakingLearnerIdAndEndedAtIsNotNull(Long learnerId);
    List<Attempt> findByQuizTakingLearnerId(Long learnerId);
    List<Attempt> findByQuizTakingLearnerIdAndEndedAtIsNotNull(Long learnerId);
    List<Attempt> findByQuizTakingLearnerIdAndEndedAtIsNotNullOrderByStartedAtDesc(Long learnerId);
    List<Attempt> findByQuizTakingLearnerIdOrderByStartedAtDesc(Long learnerId);

    @Query("SELECT a FROM Attempt a WHERE a.endedAt IS NULL AND a.quizTaking.quizAssigning.dueDate < :now")
    List<Attempt> findExpiredAttemptsByDueDate(@Param("now") LocalDateTime now);

    @Query("SELECT a FROM Attempt a WHERE a.endedAt IS NULL AND a.quizTaking.quizAssigning IS NOT NULL")
    List<Attempt> findActiveAttemptsWithAssigning();

    long countByQuizTakingIdAndEndedAtIsNotNull(Long quizTakingId);

    @Query("SELECT COUNT(a) FROM Attempt a WHERE a.quizTaking.quizAssigning.id = :assigningId")
    long countByQuizAssigningId(@Param("assigningId") Long assigningId);
}

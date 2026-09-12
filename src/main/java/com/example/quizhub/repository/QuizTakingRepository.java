package com.example.quizhub.repository;

import com.example.quizhub.entity.QuizTaking;
import com.example.quizhub.entity.enums.TakingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface QuizTakingRepository extends JpaRepository<QuizTaking, Long> {

    List<QuizTaking> findByLearnerId(Long learnerId);

    List<QuizTaking> findByQuizId(UUID quizId);

    List<QuizTaking> findByLearnerIdAndQuizId(Long learnerId, UUID quizId);
    
    Optional<QuizTaking> findByLearnerIdAndQuizAssigningId(Long learnerId, Long quizAssigningId);
    
    List<QuizTaking> findByQuizAssigningId(Long quizAssigningId);

    List<QuizTaking> findByStatus(TakingStatus status);
    
    List<QuizTaking> findByLearnerIdAndStatusIn(Long learnerId, java.util.Collection<TakingStatus> statuses);

    List<QuizTaking> findByLearnerIdAndQuizIdAndIsAssignedFalse(Long learnerId, UUID quizId);
    
    List<QuizTaking> findByLearnerIdAndQuizIdAndQuizAssigningIsNull(Long learnerId, UUID quizId);

    long countByLearnerId(Long learnerId);
}

package com.example.quizhub.repository;

import com.example.quizhub.entity.UserAttemptAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface UserAttemptAnswerRepository extends JpaRepository<UserAttemptAnswer, Long> {

    List<UserAttemptAnswer> findByAttemptId(Long attemptId);

    List<UserAttemptAnswer> findByQuestionId(Long questionId);

    @Modifying
    @Transactional
    void deleteByAttemptIdAndQuestionId(Long attemptId, Long questionId);

    @Modifying
    @Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM UserAttemptAnswer u WHERE u.attempt.id = :attemptId")
    void deleteByAttemptId(@org.springframework.data.repository.query.Param("attemptId") Long attemptId);
}

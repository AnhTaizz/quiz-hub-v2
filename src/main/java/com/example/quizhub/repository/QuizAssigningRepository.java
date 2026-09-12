package com.example.quizhub.repository;

import com.example.quizhub.entity.QuizAssigning;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface QuizAssigningRepository extends JpaRepository<QuizAssigning, Long> {

    @EntityGraph(attributePaths = {"quiz", "quiz.category", "quiz.creator", "topic"})
    List<QuizAssigning> findByClassroomId(Long classroomId);

    @EntityGraph(attributePaths = {"quiz", "quiz.category", "quiz.creator", "topic"})
    List<QuizAssigning> findByQuizId(UUID quizId);

    @EntityGraph(attributePaths = {"quiz", "quiz.category", "quiz.creator", "topic"})
    List<QuizAssigning> findByClassroomIdAndQuizId(Long classroomId, UUID quizId);

    @EntityGraph(attributePaths = {"quiz", "quiz.category", "quiz.creator", "topic"})
    List<QuizAssigning> findByClassroomCreatorId(Long teacherId);

    @Query(value = "SELECT COUNT(*) FROM _quiz_assigning WHERE quiz_id = :quizId", nativeQuery = true)
    long countAnyByQuizIdIncludingDeleted(@Param("quizId") UUID quizId);

    /** Tìm assigning kể cả đã soft-delete — dùng cho trang giám sát/điểm lịch sử */
    @Query(value = "SELECT * FROM _quiz_assigning WHERE id = :id", nativeQuery = true)
    Optional<QuizAssigning> findByIdIncludingDeleted(@Param("id") Long id);
}

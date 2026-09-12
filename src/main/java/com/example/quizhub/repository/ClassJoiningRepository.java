package com.example.quizhub.repository;

import com.example.quizhub.entity.ClassJoining;
import com.example.quizhub.entity.enums.JoinStatus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassJoiningRepository extends JpaRepository<ClassJoining, Long> {

    List<ClassJoining> findByClassroomId(Long classroomId);

    List<ClassJoining> findByClassroomIdAndStatus(Long classroomId, JoinStatus status);

    List<ClassJoining> findByLearnerId(Long learnerId);

    List<ClassJoining> findByLearnerIdAndStatusIn(Long learnerId, java.util.Collection<JoinStatus> statuses);

    Optional<ClassJoining> findByClassroomIdAndLearnerId(Long classroomId, Long learnerId);

    long countByClassroomIdAndStatus(Long classroomId, JoinStatus status);

    @Query("SELECT COUNT(DISTINCT cj.learner) FROM ClassJoining cj WHERE cj.classroom.creator.id = :teacherId AND cj.status = com.example.quizhub.entity.enums.JoinStatus.APPROVED")
    long countDistinctLearnersByTeacherId(@Param("teacherId") Long teacherId);
}

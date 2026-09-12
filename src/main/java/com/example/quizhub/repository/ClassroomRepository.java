package com.example.quizhub.repository;

import com.example.quizhub.entity.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, Long> {

    Optional<Classroom> findByCode(String code);

    boolean existsByCode(String code);

    List<Classroom> findByCreatorId(Long creatorId);
    long countByCreatorId(Long creatorId);

    List<Classroom> findByIsEnableTrue();
}

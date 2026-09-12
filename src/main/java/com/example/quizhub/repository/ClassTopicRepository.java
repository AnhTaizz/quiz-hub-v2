package com.example.quizhub.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.quizhub.entity.ClassTopic;

@Repository
public interface ClassTopicRepository extends JpaRepository<ClassTopic, Long> {
    List<ClassTopic> findByClassroomId(Long classroomId);
}

package com.example.quizhub.repository;

import com.example.quizhub.entity.Quiz;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QuizRepository extends JpaRepository<Quiz, UUID> {

    @EntityGraph(attributePaths = {"category", "creator"})
    List<Quiz> findByCreatorId(Long creatorId);

    @EntityGraph(attributePaths = {"category", "creator"})
    List<Quiz> findByCreatorIdAndIsEnableTrue(Long creatorId);

    @EntityGraph(attributePaths = {"category", "creator"})
    List<Quiz> findByIsDraftFalseAndIsEnableTrue();

    @EntityGraph(attributePaths = {"category", "creator"})
    List<Quiz> findByIsExamTrue();

    /** Quiz công khai (published) theo danh mục */
    @EntityGraph(attributePaths = {"category", "creator"})
    List<Quiz> findByCategoryIdAndIsDraftFalseAndIsEnableTrue(Long categoryId);
    @EntityGraph(attributePaths = {"category", "creator"})
    List<Quiz> findByCategoryIdInAndIsDraftFalseAndIsEnableTrue(List<Long> categoryIds);

    /** Quiz của một người dùng cụ thể theo danh mục (bao gồm cả draft) */
    @EntityGraph(attributePaths = {"category", "creator"})
    List<Quiz> findByCategoryIdAndCreatorIdAndIsEnableTrue(Long categoryId, Long creatorId);
    @EntityGraph(attributePaths = {"category", "creator"})
    List<Quiz> findByCategoryIdInAndCreatorIdAndIsEnableTrue(List<Long> categoryIds, Long creatorId);

    /** Đếm quiz công khai theo danh mục (để hiển thị badge count) */
    long countByCategoryIdAndIsDraftFalseAndIsEnableTrue(Long categoryId);
    long countByCategoryIdInAndIsDraftFalseAndIsEnableTrue(List<Long> categoryIds);

    /** Đếm quiz cá nhân theo danh mục */
    long countByCategoryIdAndCreatorIdAndIsEnableTrue(Long categoryId, Long creatorId);
    long countByCategoryIdInAndCreatorIdAndIsEnableTrue(List<Long> categoryIds, Long creatorId);

    List<Quiz> findByCategoryId(Long categoryId);

    long countByCategoryId(Long categoryId);
    long countByCategoryIdIn(List<Long> categoryIds);
}

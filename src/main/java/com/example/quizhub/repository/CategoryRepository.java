package com.example.quizhub.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.example.quizhub.entity.Category;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    Optional<Category> findById(Long id);

    List<Category> findByParentIsNull();

    @Query("SELECT c FROM Category c WHERE c.parent.id = :parentId")
    List<Category> findByParentId(@Param("parentId") Long parentId);

    /**
     * Lấy tất cả danh mục công khai kèm parent (JOIN FETCH tránh LazyInitializationException).
     */
    @Query("SELECT c FROM Category c LEFT JOIN FETCH c.parent WHERE c.isPublic = true")
    List<Category> findAllPublicWithParent();

    /**
     * Lấy tất cả danh mục của một user cụ thể kèm parent.
     */
    @Query("SELECT c FROM Category c LEFT JOIN FETCH c.parent WHERE c.creator.id = :creatorId")
    List<Category> findAllByCreatorIdWithParent(@Param("creatorId") Long creatorId);

    long countByIsPublicTrue();

    List<Category> findTop5ByIsPublicTrueOrderByIdDesc();
}

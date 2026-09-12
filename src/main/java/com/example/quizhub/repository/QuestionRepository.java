package com.example.quizhub.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.example.quizhub.entity.Question;
import com.example.quizhub.entity.enums.QuestionLevel;
import com.example.quizhub.entity.enums.QuestionStatus;
import com.example.quizhub.entity.enums.QuestionType;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {

       List<Question> findByCreatorId(Long creatorId);

       long countByCreatorId(Long creatorId);

       List<Question> findByCategoryId(Long categoryId);

       Page<Question> findByCategoryId(Long categoryId, Pageable pageable);

       List<Question> findByType(QuestionType type);

       List<Question> findByQuestionStatus(QuestionStatus status);

       // 1. Kho Riêng: Lấy câu hỏi của cá nhân (Chỉ lấy các câu hỏi không phải
       // DELETED)
       @Query(value = "SELECT q FROM Question q " +
                     "WHERE q.creator.id = :userId " +
                     "AND q.questionStatus != com.example.quizhub.entity.enums.QuestionStatus.DELETED " +
                     "AND (:useCategoryFilter = false OR (-1 IN :categoryIds AND q.category IS NULL) OR q.category.id IN :categoryIds) "
                     +
                     "AND (:type IS NULL OR q.type = :type) " +
                     "AND (:level IS NULL OR q.level = :level) " +
                     "AND (:keyword IS NULL OR LOWER(CAST(q.text AS string)) LIKE :keyword)", countQuery = "SELECT COUNT(q) FROM Question q "
                                   +
                                   "WHERE q.creator.id = :userId " +
                                   "AND q.questionStatus != com.example.quizhub.entity.enums.QuestionStatus.DELETED " +
                                   "AND (:useCategoryFilter = false OR (-1 IN :categoryIds AND q.category IS NULL) OR q.category.id IN :categoryIds) "
                                   +
                                   "AND (:type IS NULL OR q.type = :type) " +
                                   "AND (:level IS NULL OR q.level = :level) " +
                                   "AND (:keyword IS NULL OR LOWER(CAST(q.text AS string)) LIKE :keyword)")
       Page<Question> searchMyQuestion(@Param("userId") Long userId,
                     @Param("useCategoryFilter") boolean useCategoryFilter,
                     @Param("categoryIds") List<Long> categoryIds,
                     @Param("type") QuestionType type,
                     @Param("level") QuestionLevel level,
                     @Param("keyword") String keyword,
                     Pageable pageable);

       // 2. Kho Chung: Lấy câu hỏi đã được Public của hệ thống
       @Query(value = "SELECT q FROM Question q " +
                     "WHERE q.questionStatus = :status " +
                     "AND (:useCategoryFilter = false OR (-1 IN :categoryIds AND q.category IS NULL) OR q.category.id IN :categoryIds) "
                     +
                     "AND (:type IS NULL OR q.type = :type) " +
                     "AND (:level IS NULL OR q.level = :level) " +
                     "AND (:keyword IS NULL OR LOWER(CAST(q.text AS string)) LIKE :keyword)", countQuery = "SELECT COUNT(q) FROM Question q "
                                   +
                                   "WHERE q.questionStatus = :status " +
                                   "AND (:useCategoryFilter = false OR (-1 IN :categoryIds AND q.category IS NULL) OR q.category.id IN :categoryIds) "
                                   +
                                   "AND (:type IS NULL OR q.type = :type) " +
                                   "AND (:level IS NULL OR q.level = :level) " +
                                   "AND (:keyword IS NULL OR LOWER(CAST(q.text AS string)) LIKE :keyword)")
       Page<Question> searchPublicQuestion(@Param("useCategoryFilter") boolean useCategoryFilter,
                     @Param("categoryIds") List<Long> categoryIds,
                     @Param("type") QuestionType type,
                     @Param("level") QuestionLevel level,
                     @Param("keyword") String keyword,
                     @Param("status") QuestionStatus status,
                     Pageable pageable);

       // 3. Tìm kiếm chung (Dùng cho Admin và các mục lọc nâng cao)
       @Query(value = "SELECT q FROM Question q " +
                     "WHERE (:status IS NULL OR q.questionStatus = :status) " +
                     "AND (:useCategoryFilter = false OR (-1 IN :categoryIds AND q.category IS NULL) OR q.category.id IN :categoryIds) "
                     +
                     "AND (:type IS NULL OR q.type = :type) " +
                     "AND (:level IS NULL OR q.level = :level) " +
                     "AND (:keyword IS NULL OR LOWER(CAST(q.text AS string)) LIKE :keyword) " +
                     "AND (:creatorName IS NULL OR LOWER(q.creator.fullName) LIKE :creatorName)", countQuery = "SELECT COUNT(q) FROM Question q "
                                   +
                                   "WHERE (:status IS NULL OR q.questionStatus = :status) " +
                                   "AND (:useCategoryFilter = false OR (-1 IN :categoryIds AND q.category IS NULL) OR q.category.id IN :categoryIds) "
                                   +
                                   "AND (:type IS NULL OR q.type = :type) " +
                                   "AND (:level IS NULL OR q.level = :level) " +
                                   "AND (:keyword IS NULL OR LOWER(CAST(q.text AS string)) LIKE :keyword) " +
                                   "AND (:creatorName IS NULL OR LOWER(q.creator.fullName) LIKE :creatorName)")
       Page<Question> searchQuestions(@Param("status") QuestionStatus status,
                     @Param("useCategoryFilter") boolean useCategoryFilter,
                     @Param("categoryIds") List<Long> categoryIds,
                     @Param("type") QuestionType type,
                     @Param("level") QuestionLevel level,
                     @Param("keyword") String keyword,
                     @Param("creatorName") String creatorName,
                     Pageable pageable);

       // Kiểm tra câu hỏi đã nằm trong đề thi nào chưa
       @Query("SELECT CASE WHEN COUNT(q) > 0 THEN true ELSE false END "
                     + "FROM Quiz q JOIN q.questions quest "
                     + "WHERE quest.id = :questionId")
       boolean isQuestionUsedInQuiz(@Param("questionId") Long questionId);

       // Kiểm tra câu hỏi đã được luyện tập chưa
       @Query("SELECT CASE WHEN COUNT(pd) > 0 THEN true ELSE false END "
                     + "FROM PracticeDetail pd "
                     + "WHERE pd.question.id = :questionId")
       boolean isQuestionUsedInPractice(@Param("questionId") Long questionId);

       // Tìm các câu hỏi đang chờ duyệt để Admin xử lý
       Page<Question> findByQuestionStatus(QuestionStatus status, Pageable pageable);

       long countByQuestionStatus(QuestionStatus status);

       long countByCategoryId(Long categoryId);

       List<Question> findTop5ByQuestionStatusOrderByIdDesc(QuestionStatus status);

       @Query("SELECT q.id FROM Question q WHERE q.category.id = :categoryId AND q.questionStatus = :status ORDER BY q.id ASC")
       List<Long> findQuestionIdsByCategoryAndStatus(@Param("categoryId") Long categoryId,
                     @Param("status") QuestionStatus status);

       @Query("SELECT q.id FROM Question q WHERE ((-1 IN :categoryIds AND q.category IS NULL) OR q.category.id IN :categoryIds) AND q.questionStatus = :status ORDER BY q.id ASC")
       List<Long> findQuestionIdsByCategoryInAndStatus(@Param("categoryIds") List<Long> categoryIds,
                     @Param("status") QuestionStatus status);

       @Query("SELECT q.id FROM Question q " +
              "WHERE ((-1 IN :categoryIds AND q.category IS NULL) OR q.category.id IN :categoryIds) " +
              "AND q.questionStatus != com.example.quizhub.entity.enums.QuestionStatus.DELETED " +
              "AND (q.creator.id = :userId OR q.questionStatus = com.example.quizhub.entity.enums.QuestionStatus.PUBLIC) " +
              "ORDER BY q.id ASC")
       List<Long> findValidQuestionIdsForGeneration(@Param("categoryIds") List<Long> categoryIds,
                     @Param("userId") Long userId);

       @Query(value = "SELECT * FROM _question WHERE category_id IN :categoryIds AND approval_status = 'PUBLIC' ORDER BY RANDOM() LIMIT :limit", nativeQuery = true)
       List<Question> findRandomPublicQuestionsByCategories(@Param("categoryIds") List<Long> categoryIds,
                     @Param("limit") int limit);

       @Query(value = "SELECT * FROM _question WHERE category_id = :categoryId AND approval_status = 'PUBLIC' ORDER BY RANDOM() LIMIT :limit", nativeQuery = true)
       List<Question> findRandomPublicQuestionsByCategory(@Param("categoryId") Long categoryId,
                     @Param("limit") int limit);

       @Query("SELECT q FROM Question q WHERE q.category.id IN :categoryIds AND q.questionStatus = com.example.quizhub.entity.enums.QuestionStatus.PUBLIC ORDER BY q.id ASC")
       List<Question> findPublicQuestionsByCategories(@Param("categoryIds") List<Long> categoryIds, Pageable pageable);

       @Query("SELECT COUNT(q) FROM Question q WHERE q.category.id IN :categoryIds AND q.questionStatus = :status")
       long countPublicQuestionsByCategories(@Param("categoryIds") List<Long> categoryIds,
                     @Param("status") QuestionStatus status);

       @Query("SELECT q.id FROM Question q " +
                     "WHERE q.creator.id = :teacherId " +
                     "AND (:status IS NULL OR q.questionStatus = :status) " +
                     "AND q.questionStatus != com.example.quizhub.entity.enums.QuestionStatus.DELETED " +
                     "AND (:useCategoryFilter = false OR (-1 IN :categoryIds AND q.category IS NULL) OR q.category.id IN :categoryIds) " +
                     "AND (:type IS NULL OR q.type = :type) " +
                     "AND (:keyword IS NULL OR LOWER(CAST(q.text AS string)) LIKE :keyword)")
       List<Long> findIdsByFilters(@Param("teacherId") Long teacherId, 
                     @Param("status") QuestionStatus status,
                     @Param("useCategoryFilter") boolean useCategoryFilter,
                     @Param("categoryIds") List<Long> categoryIds, 
                     @Param("type") QuestionType type,
                     @Param("keyword") String keyword);

       @Query("SELECT q.id FROM Question q " +
                     "WHERE q.questionStatus = :status " +
                     "AND (:useCategoryFilter = false OR (-1 IN :categoryIds AND q.category IS NULL) OR q.category.id IN :categoryIds) "
                     +
                     "AND (:type IS NULL OR q.type = :type) " +
                     "AND (:level IS NULL OR q.level = :level) " +
                     "AND (:keyword IS NULL OR LOWER(CAST(q.text AS string)) LIKE :keyword) " +
                     "AND (:creatorName IS NULL OR LOWER(q.creator.fullName) LIKE :creatorName)")
       List<Long> findPendingIdsByFilters(@Param("status") QuestionStatus status,
                     @Param("useCategoryFilter") boolean useCategoryFilter,
                     @Param("categoryIds") List<Long> categoryIds,
                     @Param("type") QuestionType type,
                     @Param("level") QuestionLevel level,
                     @Param("keyword") String keyword,
                     @Param("creatorName") String creatorName);
}

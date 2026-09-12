package com.example.quizhub.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.example.quizhub.dto.question.QuestionRequestDTO;
import com.example.quizhub.dto.question.QuestionResponseDTO;
import com.example.quizhub.entity.enums.QuestionLevel;
import com.example.quizhub.entity.enums.QuestionStatus;
import com.example.quizhub.entity.enums.QuestionType;

public interface QuestionService {
    QuestionResponseDTO createNewQuestion(Long userId, QuestionRequestDTO request);

    /** Admin tạo câu hỏi trực tiếp vào kho công khai (status = PUBLIC ngay) */
    QuestionResponseDTO createPublicQuestionByAdmin(Long adminId, QuestionRequestDTO request);

    QuestionResponseDTO updateQuestion(Long userId, Long id, QuestionRequestDTO request);

    QuestionResponseDTO getQuestionById(Long id);

    List<QuestionResponseDTO> getQuestionsByIds(List<Long> ids);

    void deleteQuestion(Long userId, Long id);

    Page<QuestionResponseDTO> searchMyQuestion(Long userId, Long categoryId,
                                                    QuestionType type,
                                                    QuestionLevel level,
                                                    String keyword,
                                                    int page,
                                                    int size,
                                                    String sortBy,
                                                    String sortDir);

    Page<QuestionResponseDTO> searchPublicQuestion(Long categoryId,
                                                   QuestionType type,
                                                   QuestionLevel level,
                                                   String keyword,
                                                   int page,
                                                   int size,
                                                   String sortBy,
                                                   String sortDir);

    Page<QuestionResponseDTO> searchQuestions(QuestionStatus status,
                                              Long categoryId,
                                              QuestionType type,
                                              QuestionLevel level,
                                              String keyword,
                                              String creatorName,
                                              int page,
                                              int size,
                                              String sortBy,
                                              String sortDir);

    //Teacher share question
    void requestShareQuestion(Long questionId, Long teacherId);

    void bulkRequestShareQuestions(List<Long> questionIds, Long teacherId);
    void bulkRequestShareAllQuestions(Long teacherId, Long categoryId, QuestionType type, String keyword);

    void bulkDeleteQuestions(List<Long> questionIds, Long teacherId);
    void bulkDeleteAllQuestions(Long teacherId, Long categoryId, QuestionType type, String keyword);

    //Admin
    void approveQuestion(Long questionId, Long categoryId);

    void bulkApproveQuestions(List<Long> questionIds, Long categoryId);

    void bulkApproveAllQuestions(Long targetCategoryId, Long filterCategoryId, QuestionType type, QuestionLevel level, String keyword, String creatorName);

    void rejectQuestion(Long questionId);
        
    void bulkRejectQuestions(List<Long> questionIds);

    void bulkRejectAllQuestions(Long filterCategoryId, QuestionType type, QuestionLevel level, String keyword, String creatorName);

    void deleteQuestionByAdmin(Long questionId);
    
    void bulkDeleteQuestionsByAdmin(List<Long> questionIds);

    void bulkDeleteAllQuestionsByAdmin(Long categoryId, QuestionType type, QuestionLevel level, String keyword, String creatorName);

    void moveQuestionByAdmin(Long questionId, Long categoryId);

    QuestionResponseDTO updateQuestionByAdmin(Long id, QuestionRequestDTO request);

    /** Lấy danh sách ID câu hỏi hợp lệ theo danh mục để sinh đề ngẫu nhiên */
    List<Long> getValidQuestionIdsForGeneration(List<Long> categoryIds, Long userId);
}

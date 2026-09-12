package com.example.quizhub.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.quizhub.dto.question.AnswerCreationRequestDTO;
import com.example.quizhub.dto.question.QuestionRequestDTO;
import com.example.quizhub.dto.question.QuestionResponseDTO;
import com.example.quizhub.entity.Answer;
import com.example.quizhub.entity.Category;
import com.example.quizhub.entity.Question;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.NotificationType;
import com.example.quizhub.entity.enums.QuestionLevel;
import com.example.quizhub.entity.enums.QuestionStatus;
import com.example.quizhub.entity.enums.QuestionType;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.mapper.QuestionMapper;
import com.example.quizhub.repository.AnswerRepository;
import com.example.quizhub.repository.CategoryRepository;
import com.example.quizhub.repository.QuestionRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.service.NotificationService;
import com.example.quizhub.service.CategoryService;
import com.example.quizhub.service.QuestionService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuestionServiceImpl implements QuestionService {

    private final UserRepository userRepository;
    private final QuestionRepository questionRepository;
    private final CategoryRepository categoryRepository;
    private final CategoryService categoryService;
    private final AnswerRepository answerRepository;
    private final QuestionMapper questionMapper;
    private final NotificationService notificationService;

    // Business Logic
    private void validateQuestionLogic(QuestionType type, List<AnswerCreationRequestDTO> answers) {
        if (answers == null || answers.isEmpty()) {
            throw new AppException(ErrorCode.QUESTION_INVALID_LOGIC); // Phải có ít nhất 1 đáp án
        }

        // Khắc phục lỗi NullPointerException bằng Boolean.TRUE.equals()
        long correctAnswersCount = answers.stream()
                .filter(ans -> Boolean.TRUE.equals(ans.getCorrect()))
                .count();

        // Ràng buộc linh hoạt theo từng loại câu hỏi
        switch (type) {
            case SINGLE_CHOICE:
                // Trắc nghiệm 1 đáp án: Bắt buộc >= 2 lựa chọn, và đúng 1 đáp án đúng
                if (answers.size() < 2 || correctAnswersCount != 1) {
                    throw new AppException(ErrorCode.QUESTION_INVALID_LOGIC);
                }
                break;
            case MULTIPLE_CHOICE:
                // Trắc nghiệm nhiều đáp án: Bắt buộc >= 2 lựa chọn, và >= 2 đáp án đúng
                if (answers.size() < 2 || correctAnswersCount < 2) {
                    throw new AppException(ErrorCode.QUESTION_INVALID_LOGIC);
                }
                break;
            case FILL_IN_BLANK:
                // Điền khuyết: Có thể chỉ có 1 lựa chọn, nhưng lựa chọn đó bắt buộc phải đánh
                // dấu là "đúng"
                if (correctAnswersCount < 1) {
                    throw new AppException(ErrorCode.QUESTION_INVALID_LOGIC);
                }
                break;
        }
    }

    @Override
    @Transactional
    public QuestionResponseDTO createNewQuestion(Long userId, QuestionRequestDTO request) {
        validateQuestionLogic(request.getType(), request.getAnswers()); // ktra logic

        User creator = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Category category = null;
        if (request.getCategoryId() != null && request.getCategoryId() != -1L) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

            // BẢO MẬT: Chỉ cho phép gán danh mục riêng của bản thân nếu không phải ADMIN
            if (creator.getRole() != com.example.quizhub.entity.enums.Role.ADMIN) {
                if (Boolean.TRUE.equals(category.getIsPublic()) ||
                    category.getCreator() == null ||
                    !category.getCreator().getId().equals(userId)) {
                    throw new AppException(ErrorCode.UNAUTHORIZED);
                }
            }
        }

        // Tạo question entity
        Question question = Question.builder()
                .type(request.getType())
                .text(request.getText())
                .questionStatus(QuestionStatus.PRIVATE)
                .creator(creator)
                .category(category)
                .level(request.getLevel() != null ? request.getLevel() : QuestionLevel.MEDIUM)
                .build();

        List<Answer> answers = request.getAnswers().stream()
                .map(ansDto -> Answer.builder()
                        .text(ansDto.getText())
                        .isCorrect(Boolean.TRUE.equals(ansDto.getCorrect()))
                        .question(question)
                        .build())
                .collect(Collectors.toList());

        question.setAnswers(answers);

        Question saved = questionRepository.save(question);
        return questionMapper.toResponseDTO(saved);
    }

    @Override
    @Transactional
    public QuestionResponseDTO createPublicQuestionByAdmin(Long adminId, QuestionRequestDTO request) {
        validateQuestionLogic(request.getType(), request.getAnswers());

        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Category category = null;
        if (request.getCategoryId() != null && request.getCategoryId() != -1L) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));
        }

        // Admin tạo thẳng câu hỏi PUBLIC, không cần qua PENDING
        Question question = Question.builder()
                .type(request.getType())
                .text(request.getText())
                .questionStatus(QuestionStatus.PUBLIC)
                .creator(admin)
                .category(category)
                .level(request.getLevel() != null ? request.getLevel() : QuestionLevel.MEDIUM)
                .build();

        List<Answer> answers = request.getAnswers().stream()
                .map(ansDto -> Answer.builder()
                        .text(ansDto.getText())
                        .isCorrect(Boolean.TRUE.equals(ansDto.getCorrect()))
                        .question(question)
                        .build())
                .collect(Collectors.toList());

        question.setAnswers(answers);
        Question saved = questionRepository.save(question);
        return questionMapper.toResponseDTO(saved);
    }

    @Override
    @Transactional
    public QuestionResponseDTO updateQuestion(Long userId, Long id, QuestionRequestDTO request) {
        validateQuestionLogic(request.getType(), request.getAnswers()); // ktra logic

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        Question oldQuestion = questionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));

        if (!oldQuestion.getCreator().getId().equals(userId)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        Category category = null;
        if (request.getCategoryId() != null && request.getCategoryId() != -1L) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

            // BẢO MẬT: Chỉ cho phép gán danh mục riêng của bản thân nếu không phải ADMIN
            if (user.getRole() != com.example.quizhub.entity.enums.Role.ADMIN) {
                if (Boolean.TRUE.equals(category.getIsPublic()) ||
                    category.getCreator() == null ||
                    !category.getCreator().getId().equals(userId)) {
                    throw new AppException(ErrorCode.UNAUTHORIZED);
                }
            }
        }

        boolean isUsedInQuiz = questionRepository.isQuestionUsedInQuiz(id);
        boolean isUsedInPractice = questionRepository.isQuestionUsedInPractice(id);

        if (isUsedInQuiz || isUsedInPractice) {
            // xóa câu hỏi cũ nếu đã dùng trong quiz hoặc luyện tập rồi
            oldQuestion.setQuestionStatus(QuestionStatus.DELETED);
            questionRepository.save(oldQuestion);
            // tạo câu hỏi mới
            Question cloneQuestion = Question.builder()
                    .type(request.getType())
                    .text(request.getText())
                    .creator(oldQuestion.getCreator())
                    .category(category)
                    .questionStatus(QuestionStatus.PRIVATE)
                    .level(request.getLevel() != null ? request.getLevel() : QuestionLevel.MEDIUM)
                    .build();

            List<Answer> cloneAnswers = request.getAnswers().stream()
                    .map(ansDto -> Answer.builder()
                            .text(ansDto.getText())
                            .isCorrect(Boolean.TRUE.equals(ansDto.getCorrect()))
                            .question(cloneQuestion)
                            .build())
                    .collect(Collectors.toList());

            cloneQuestion.setAnswers(cloneAnswers);
            Question saved = questionRepository.save(cloneQuestion);
            return questionMapper.toResponseDTO(saved);

        } else {
            // Câu hỏi chưa nằm trong quiz nào
            oldQuestion.setText(request.getText());
            oldQuestion.setType(request.getType());
            oldQuestion.setCategory(category);
            oldQuestion.setQuestionStatus(QuestionStatus.PRIVATE);
            if (request.getLevel() != null) {
                oldQuestion.setLevel(request.getLevel());
            }

            List<Answer> newAnswers = request.getAnswers().stream()
                    .map(ansDto -> Answer.builder()
                            .text(ansDto.getText())
                            .isCorrect(Boolean.TRUE.equals(ansDto.getCorrect()))
                            .question(oldQuestion)
                            .build())
                    .collect(Collectors.toList());

            oldQuestion.getAnswers().clear();
            oldQuestion.getAnswers().addAll(newAnswers);

            Question saved = questionRepository.save(oldQuestion);
            return questionMapper.toResponseDTO(saved);
        }
    }


    @Override
    @Transactional(readOnly = true)
    public Page<QuestionResponseDTO> searchMyQuestion(Long userId, Long categoryId, QuestionType type,
            QuestionLevel level, String keyword,
            int page, int size,
            String sortBy, String sortDir) {

        Sort sort = sortDir.equalsIgnoreCase(Sort.Direction.ASC.name())
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();

        Pageable pageable = PageRequest.of(page, size, sort);

        boolean useCategoryFilter = false;
        List<Long> categoryIds = new java.util.ArrayList<>();
        if (categoryId != null) {
            if (categoryId == -1L) {
                categoryIds.add(-1L);
            } else {
                categoryIds = categoryService.getAllDescendantIds(categoryId);
            }
            useCategoryFilter = true;
        }

        String searchKeyword = (keyword == null || keyword.trim().isEmpty()) ? null
                : "%" + keyword.trim().toLowerCase() + "%";
        Page<Question> questionPage = questionRepository.searchMyQuestion(userId, useCategoryFilter, categoryIds, type,
                level, searchKeyword, pageable);

        return questionPage.map(questionMapper::toResponseDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<QuestionResponseDTO> searchPublicQuestion(Long categoryId, QuestionType type,
            QuestionLevel level, String keyword, int page, int size,
            String sortBy, String sortDir) {

        Sort sort = sortDir.equalsIgnoreCase(Sort.Direction.ASC.name())
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();

        Pageable pageable = PageRequest.of(page, size, sort);

        boolean useCategoryFilter = false;
        List<Long> categoryIds = new java.util.ArrayList<>();
        if (categoryId != null) {
            if (categoryId == -1L) {
                categoryIds.add(-1L);
            } else {
                categoryIds = categoryService.getAllDescendantIds(categoryId);
            }
            useCategoryFilter = true;
        }

        String searchKeyword = (keyword == null || keyword.trim().isEmpty()) ? null
                : "%" + keyword.trim().toLowerCase() + "%";
        Page<Question> questionPage = questionRepository.searchPublicQuestion(useCategoryFilter, categoryIds, type,
                level, searchKeyword, QuestionStatus.PUBLIC, pageable);

        return questionPage.map(questionMapper::toResponseDTO);
    }

    @Override
    public Page<QuestionResponseDTO> searchQuestions(QuestionStatus status, Long categoryId, QuestionType type,
            QuestionLevel level, String keyword, String creatorName,
            int page, int size, String sortBy, String sortDir) {

        Sort sort = sortDir.equalsIgnoreCase(Sort.Direction.ASC.name())
                ? Sort.by(sortBy).ascending()
                : Sort.by(sortBy).descending();

        Pageable pageable = PageRequest.of(page, size, sort);

        boolean useCategoryFilter = false;
        List<Long> categoryIds = new java.util.ArrayList<>();
        if (categoryId != null) {
            if (categoryId == -1L) {
                categoryIds.add(-1L);
            } else {
                categoryIds = categoryService.getAllDescendantIds(categoryId);
            }
            useCategoryFilter = true;
        }

        String searchKeyword = (keyword == null || keyword.trim().isEmpty()) ? null
                : "%" + keyword.trim().toLowerCase() + "%";
        String searchCreator = (creatorName == null || creatorName.trim().isEmpty()) ? null
                : "%" + creatorName.trim().toLowerCase() + "%";

        Page<Question> questionPage = questionRepository.searchQuestions(status, useCategoryFilter, categoryIds, type,
                level, searchKeyword, searchCreator, pageable);

        return questionPage.map(questionMapper::toResponseDTO);
    }

    @Override
    public QuestionResponseDTO getQuestionById(Long id) {
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));
        return questionMapper.toResponseDTO(question);
    }

    @Override
    @Transactional(readOnly = true)
    public List<QuestionResponseDTO> getQuestionsByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new ArrayList<>();
        }
        return questionRepository.findAllById(ids).stream()
                .map(questionMapper::toResponseDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void deleteQuestion(Long userId, Long id) {
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));
        if (!question.getCreator().getId().equals(userId)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        question.setQuestionStatus(QuestionStatus.DELETED);
        questionRepository.save(question);
    }

    @Override
    @Transactional
    public void requestShareQuestion(Long questionId, Long teacherId) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));

        // Kiểm tra quyền sở hữu
        if (!question.getCreator().getId().equals(teacherId)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        if (question.getQuestionStatus() == QuestionStatus.PUBLIC) {
            throw new AppException(ErrorCode.QUESTION_ALREADY_PUBLIC);
        }

        // Chuyển trạng thái sang PENDING (chưa public ngay)
        question.setQuestionStatus(QuestionStatus.PENDING);
        questionRepository.save(question);

        // Gửi thông báo cho Admin
        try {
            userRepository.findByRole(com.example.quizhub.entity.enums.Role.ADMIN).forEach(admin -> {
                notificationService.createNotification(
                        admin.getId(),
                        "Yêu cầu duyệt câu hỏi",
                        "Giáo viên " + question.getCreator().getFullName() + " vừa gửi yêu cầu duyệt một câu hỏi mới.",
                        NotificationType.SYSTEM_ALERT,
                        "/admin/moderation");
            });
        } catch (Exception e) {
            log.error("Gửi thông báo yêu cầu duyệt câu hỏi cho Admin thất bại: questionId={}, teacherId={}", questionId, teacherId, e);
        }
    }

    @Override
    @Transactional
    public void bulkRequestShareQuestions(List<Long> questionIds, Long teacherId) {
        if (questionIds == null || questionIds.isEmpty())
            return;

        List<Question> questions = questionRepository.findAllById(questionIds);
        List<Question> toUpdate = new ArrayList<>();
        String teacherName = "";

        for (Question q : questions) {
            // Kiểm tra quyền sở hữu và trạng thái
            if (q.getCreator().getId().equals(teacherId) && q.getQuestionStatus() == QuestionStatus.PRIVATE) {
                q.setQuestionStatus(QuestionStatus.PENDING);
                toUpdate.add(q);
                if (teacherName.isEmpty()) teacherName = q.getCreator().getFullName();
            }
        }

        if (toUpdate.isEmpty()) return;

        questionRepository.saveAll(toUpdate);

        // Gửi 1 thông báo duy nhất cho Admin
        try {
            String finalTeacherName = teacherName;
            userRepository.findByRole(com.example.quizhub.entity.enums.Role.ADMIN).forEach(admin -> {
                notificationService.createNotification(
                        admin.getId(),
                        "Yêu cầu duyệt câu hỏi hàng loạt",
                        "Giáo viên " + finalTeacherName + " vừa gửi " + toUpdate.size() + " câu hỏi mới chờ duyệt.",
                        NotificationType.SYSTEM_ALERT,
                        "/admin/moderation");
            });
        } catch (Exception e) {
            log.error("Gửi thông báo duyệt câu hỏi hàng loạt cho Admin thất bại: teacherId={}, count={}", teacherId, toUpdate.size(), e);
        }
    }

    @Override
    @Transactional
    public void bulkRequestShareAllQuestions(Long teacherId, Long categoryId, QuestionType type, String keyword) {
        boolean useCategoryFilter = false;
        List<Long> categoryIds = new java.util.ArrayList<>();
        if (categoryId != null) {
            if (categoryId == -1L) {
                categoryIds.add(-1L);
            } else {
                categoryIds = categoryService.getAllDescendantIds(categoryId);
            }
            useCategoryFilter = true;
        }

        String searchKeyword = (keyword != null && !keyword.isEmpty()) ? "%" + keyword.toLowerCase() + "%" : null;
        List<Long> ids = questionRepository.findIdsByFilters(teacherId, QuestionStatus.PRIVATE, useCategoryFilter, categoryIds, type,
                searchKeyword);
        bulkRequestShareQuestions(ids, teacherId);
    }

    @Override
    @Transactional
    public void bulkDeleteQuestions(List<Long> questionIds, Long teacherId) {
        if (questionIds == null || questionIds.isEmpty())
            return;
        List<Question> questions = questionRepository.findAllById(questionIds);
        List<Question> toDelete = new ArrayList<>();
        for (Question q : questions) {
            if (q.getCreator().getId().equals(teacherId)) {
                q.setQuestionStatus(QuestionStatus.DELETED);
                toDelete.add(q);
            }
        }
        if (!toDelete.isEmpty()) {
            questionRepository.saveAll(toDelete);
        }
    }

    @Override
    @Transactional
    public void bulkDeleteAllQuestions(Long teacherId, Long categoryId, QuestionType type, String keyword) {
        boolean useCategoryFilter = false;
        List<Long> categoryIds = new java.util.ArrayList<>();
        if (categoryId != null) {
            if (categoryId == -1L) {
                categoryIds.add(-1L);
            } else {
                categoryIds = categoryService.getAllDescendantIds(categoryId);
            }
            useCategoryFilter = true;
        }

        String searchKeyword = (keyword != null && !keyword.isEmpty()) ? "%" + keyword.toLowerCase() + "%" : null;
        // Pass status = null to find and delete ANY of the teacher's non-deleted questions matching current filter!
        List<Long> ids = questionRepository.findIdsByFilters(teacherId, null, useCategoryFilter, categoryIds, type,
                searchKeyword);
        bulkDeleteQuestions(ids, teacherId);
    }

    // Admin duyệt
    @Override
    @Transactional
    public void approveQuestion(Long questionId, Long categoryId) {
        Question originalQuestion = questionRepository.findById(questionId)
                .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));

        Category category = null;
        if (categoryId != null && categoryId != -1L) {
            category = categoryRepository.findById(categoryId)
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));
        }

        Question clone = new Question();
        clone.setText(originalQuestion.getText());
        clone.setType(originalQuestion.getType());
        clone.setLevel(originalQuestion.getLevel());
        clone.setCreator(originalQuestion.getCreator());
        clone.setCategory(category);
        clone.setQuestionStatus(QuestionStatus.PUBLIC);

        Question savedClone = questionRepository.save(clone);

        if (originalQuestion.getAnswers() != null) {
            List<Answer> clonedAnswers = new ArrayList<>();
            for (Answer ans : originalQuestion.getAnswers()) {
                Answer clonedAns = new Answer();
                clonedAns.setText(ans.getText());
                clonedAns.setIsCorrect(ans.getIsCorrect());
                clonedAns.setQuestion(savedClone);
                clonedAnswers.add(clonedAns);
            }
            answerRepository.saveAll(clonedAnswers);
            savedClone.setAnswers(clonedAnswers);
        }


        originalQuestion.setQuestionStatus(QuestionStatus.PRIVATE);
        questionRepository.save(originalQuestion);

        notificationService.createNotification(
                originalQuestion.getCreator().getId(),
                "Câu hỏi được phê duyệt",
                "Câu hỏi \"" + originalQuestion.getText() + "\" của bạn đã được Admin phê duyệt vào kho chung.",
                NotificationType.QUESTION_APPROVED,
                "/teacher/questions");
    }

    @Override
    @Transactional
    public void bulkApproveQuestions(List<Long> questionIds, Long categoryId) {
        if (questionIds == null || questionIds.isEmpty())
            return;

        List<Question> originals = questionRepository.findAllById(questionIds);
        Category category = null;
        if (categoryId != null && categoryId != -1L) {
            category = categoryRepository.findById(categoryId).orElse(null);
        }

        List<Question> clones = new ArrayList<>();
        List<Answer> allClonedAnswers = new ArrayList<>();
        java.util.Map<Long, Integer> teacherApprovalCount = new java.util.HashMap<>();

        for (Question orig : originals) {
            if (orig.getQuestionStatus() != QuestionStatus.PENDING) continue;

            // Clone Question
            Question clone = new Question();
            clone.setText(orig.getText());
            clone.setType(orig.getType());
            clone.setLevel(orig.getLevel());
            clone.setCreator(orig.getCreator());
            clone.setCategory(category);
            clone.setQuestionStatus(QuestionStatus.PUBLIC);
            clones.add(clone);

            // Clone Answers (will save after question to get ID)
            if (orig.getAnswers() != null) {
                for (Answer ans : orig.getAnswers()) {
                    Answer clonedAns = new Answer();
                    clonedAns.setText(ans.getText());
                    clonedAns.setIsCorrect(ans.getIsCorrect());
                    clonedAns.setQuestion(clone);
                    allClonedAnswers.add(clonedAns);
                }
            }

            // Mark original as PRIVATE
            orig.setQuestionStatus(QuestionStatus.PRIVATE);

            // Count for notification
            Long tId = orig.getCreator().getId();
            teacherApprovalCount.put(tId, teacherApprovalCount.getOrDefault(tId, 0) + 1);
        }

        if (clones.isEmpty()) return;

        questionRepository.saveAll(clones);
        answerRepository.saveAll(allClonedAnswers);
        questionRepository.saveAll(originals);

        // Send consolidated notifications to teachers
        teacherApprovalCount.forEach((tId, count) -> {
            notificationService.createNotification(
                tId,
                "Câu hỏi được phê duyệt hàng loạt",
                "Có " + count + " câu hỏi của bạn đã được Admin phê duyệt vào kho chung.",
                NotificationType.QUESTION_APPROVED,
                "/teacher/questions"
            );
        });
    }

    @Override
    @Transactional
    public void bulkApproveAllQuestions(Long targetCategoryId, Long filterCategoryId, QuestionType type,
            QuestionLevel level, String keyword, String creatorName) {
        boolean useCategoryFilter = false;
        List<Long> categoryIds = new java.util.ArrayList<>();
        if (filterCategoryId != null) {
            if (filterCategoryId == -1L) {
                categoryIds.add(-1L);
            } else {
                categoryIds = categoryService.getAllDescendantIds(filterCategoryId);
            }
            useCategoryFilter = true;
        }

        String searchKeyword = (keyword != null && !keyword.isEmpty()) ? "%" + keyword.toLowerCase() + "%" : null;
        String searchCreator = (creatorName != null && !creatorName.isEmpty()) ? "%" + creatorName.toLowerCase() + "%"
                : null;
        List<Long> ids = questionRepository.findPendingIdsByFilters(QuestionStatus.PENDING, useCategoryFilter,
                categoryIds, type, level, searchKeyword, searchCreator);
        bulkApproveQuestions(ids, targetCategoryId);
    }

    // Admin từ chối
    @Override
    @Transactional
    public void rejectQuestion(Long questionId) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));

        question.setQuestionStatus(QuestionStatus.PRIVATE);
        questionRepository.save(question);

        // Tạo thông báo cho giáo viên
        notificationService.createNotification(
                question.getCreator().getId(),
                "Câu hỏi bị từ chối",
                "Câu hỏi \"" + question.getText() + "\" của bạn đã bị Admin từ chối chia sẻ.",
                NotificationType.QUESTION_REJECTED,
                "/teacher/questions");
    }

    @Override
    @Transactional
    public void bulkRejectQuestions(List<Long> questionIds) {
        if (questionIds == null || questionIds.isEmpty())
            return;

        List<Question> questions = questionRepository.findAllById(questionIds);
        java.util.Map<Long, Integer> teacherRejectCount = new java.util.HashMap<>();

        for (Question q : questions) {
            if (q.getQuestionStatus() == QuestionStatus.PENDING) {
                q.setQuestionStatus(QuestionStatus.PRIVATE);
                Long tId = q.getCreator().getId();
                teacherRejectCount.put(tId, teacherRejectCount.getOrDefault(tId, 0) + 1);
            }
        }

        if (questions.isEmpty()) return;
        questionRepository.saveAll(questions);

        // Consolidated notifications
        teacherRejectCount.forEach((tId, count) -> {
            notificationService.createNotification(
                tId,
                "Câu hỏi bị từ chối hàng loạt",
                "Có " + count + " câu hỏi của bạn đã bị Admin từ chối chia sẻ.",
                NotificationType.QUESTION_REJECTED,
                "/teacher/questions"
            );
        });
    }

    @Override
    @Transactional
    public void bulkRejectAllQuestions(Long filterCategoryId, QuestionType type, QuestionLevel level, String keyword,
            String creatorName) {
        boolean useCategoryFilter = false;
        List<Long> categoryIds = new java.util.ArrayList<>();
        if (filterCategoryId != null) {
            if (filterCategoryId == -1L) {
                categoryIds.add(-1L);
            } else {
                categoryIds = categoryService.getAllDescendantIds(filterCategoryId);
            }
            useCategoryFilter = true;
        }

        String searchKeyword = (keyword != null && !keyword.isEmpty()) ? "%" + keyword.toLowerCase() + "%" : null;
        String searchCreator = (creatorName != null && !creatorName.isEmpty()) ? "%" + creatorName.toLowerCase() + "%"
                : null;
        List<Long> ids = questionRepository.findPendingIdsByFilters(QuestionStatus.PENDING, useCategoryFilter,
                categoryIds, type, level, searchKeyword, searchCreator);
        bulkRejectQuestions(ids);
    }

    // Admin xóa
    @Override
    @Transactional
    public void deleteQuestionByAdmin(Long questionId) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));

        question.setQuestionStatus(QuestionStatus.DELETED);
        questionRepository.save(question);
    }

    @Override
    @Transactional
    public void bulkDeleteQuestionsByAdmin(List<Long> questionIds) {
        if (questionIds == null || questionIds.isEmpty()) return;
        List<Question> questions = questionRepository.findAllById(questionIds);
        for (Question q : questions) {
            // Admin có quyền xóa câu hỏi ở bất kỳ trạng thái nào (trừ đã xóa rồi)
            if (q.getQuestionStatus() != QuestionStatus.DELETED) {
                q.setQuestionStatus(QuestionStatus.DELETED);
            }
        }
        questionRepository.saveAll(questions);
    }

    @Override
    @Transactional
    public void bulkDeleteAllQuestionsByAdmin(Long categoryId, QuestionType type, QuestionLevel level, String keyword, String creatorName) {
        boolean useCategoryFilter = false;
        List<Long> categoryIds = new java.util.ArrayList<>();
        if (categoryId != null) {
            if (categoryId == -1L) {
                categoryIds.add(-1L);
            } else {
                categoryIds = categoryService.getAllDescendantIds(categoryId);
            }
            useCategoryFilter = true;
        }

        String searchKeyword = (keyword != null && !keyword.isEmpty()) ? "%" + keyword.toLowerCase() + "%" : null;
        String searchCreator = (creatorName != null && !creatorName.isEmpty()) ? "%" + creatorName.toLowerCase() + "%" : null;
        
        List<Long> ids = questionRepository.findPendingIdsByFilters(QuestionStatus.PUBLIC, useCategoryFilter, categoryIds, type, level, searchKeyword, searchCreator);
        bulkDeleteQuestionsByAdmin(ids);
    }

    @Override
    @Transactional
    public void moveQuestionByAdmin(Long questionId, Long categoryId) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));
        Category category = null;
        if (categoryId != null && categoryId != -1L) {
            category = categoryRepository.findById(categoryId)
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));
        }
        question.setCategory(category);
        questionRepository.save(question);
    }

    // Admin sửa câu hỏi công khai
    @Override
    @Transactional
    public QuestionResponseDTO updateQuestionByAdmin(Long id, QuestionRequestDTO request) {
        validateQuestionLogic(request.getType(), request.getAnswers());

        Question oldQuestion = questionRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));

        // Admin có thể gán vào bất kỳ danh mục công khai nào (hoặc null)
        Category category = null;
        if (request.getCategoryId() != null && request.getCategoryId() != -1L) {
            category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));
        }

        boolean isUsedInQuiz = questionRepository.isQuestionUsedInQuiz(id);
        boolean isUsedInPractice = questionRepository.isQuestionUsedInPractice(id);

        if (isUsedInQuiz || isUsedInPractice) {
            // Câu hỏi đã dùng trong quiz/luyện tập → đánh dấu DELETED, tạo bản mới
            oldQuestion.setQuestionStatus(QuestionStatus.DELETED);
            questionRepository.save(oldQuestion);

            Question cloneQuestion = Question.builder()
                    .type(request.getType())
                    .text(request.getText())
                    .creator(oldQuestion.getCreator())
                    .category(category)
                    .questionStatus(QuestionStatus.PUBLIC) // Giữ nguyên PUBLIC
                    .level(request.getLevel() != null ? request.getLevel() : QuestionLevel.MEDIUM)
                    .build();

            List<Answer> cloneAnswers = request.getAnswers().stream()
                    .map(ansDto -> Answer.builder()
                            .text(ansDto.getText())
                            .isCorrect(Boolean.TRUE.equals(ansDto.getCorrect()))
                            .question(cloneQuestion)
                            .build())
                    .collect(Collectors.toList());

            cloneQuestion.setAnswers(cloneAnswers);
            Question saved = questionRepository.save(cloneQuestion);
            return questionMapper.toResponseDTO(saved);

        } else {
            // Câu hỏi chưa dùng trong quiz/practice → cập nhật trực tiếp
            oldQuestion.setText(request.getText());
            oldQuestion.setType(request.getType());
            oldQuestion.setCategory(category);
            oldQuestion.setQuestionStatus(QuestionStatus.PUBLIC); // Giữ nguyên PUBLIC
            if (request.getLevel() != null) {
                oldQuestion.setLevel(request.getLevel());
            }

            List<Answer> newAnswers = request.getAnswers().stream()
                    .map(ansDto -> Answer.builder()
                            .text(ansDto.getText())
                            .isCorrect(Boolean.TRUE.equals(ansDto.getCorrect()))
                            .question(oldQuestion)
                            .build())
                    .collect(Collectors.toList());

            oldQuestion.getAnswers().clear();
            oldQuestion.getAnswers().addAll(newAnswers);

            Question saved = questionRepository.save(oldQuestion);
            return questionMapper.toResponseDTO(saved);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> getValidQuestionIdsForGeneration(List<Long> categoryIds, Long userId) {
        return questionRepository.findValidQuestionIdsForGeneration(categoryIds, userId);
    }
}

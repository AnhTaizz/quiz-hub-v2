package com.example.quizhub.service.quiz.impl;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.*;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.quizhub.dto.quiz.request.QuizRequestDTO;
import com.example.quizhub.dto.quiz.request.QuizGenerateRequestDTO;
import com.example.quizhub.dto.quiz.request.BulkQuizCreateRequestDTO;
import com.example.quizhub.dto.question.QuestionRequestDTO;
import com.example.quizhub.service.QuestionService;
import com.example.quizhub.dto.question.QuestionResponseDTO;
import java.util.ArrayList;
import com.example.quizhub.dto.quiz.response.QuizResponseDTO;
import com.example.quizhub.dto.quiz.response.QuizSummaryDTO;
import com.example.quizhub.entity.Category;
import com.example.quizhub.entity.Question;
import com.example.quizhub.entity.Quiz;
import com.example.quizhub.entity.User;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.mapper.QuizMapper;
import com.example.quizhub.repository.CategoryRepository;
import com.example.quizhub.repository.QuestionRepository;
import com.example.quizhub.repository.QuizRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.service.quiz.QuizService;
import com.example.quizhub.entity.enums.QuestionStatus;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class QuizServiceImpl implements QuizService {

    private final QuizRepository quizRepository;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final QuizMapper quizMapper;
    private final QuestionRepository questionRepository;
    private final com.example.quizhub.repository.QuizTakingRepository quizTakingRepository;
    private final com.example.quizhub.repository.AttemptRepository attemptRepository;
    private final com.example.quizhub.repository.QuizAssigningRepository quizAssigningRepository;
    private final com.example.quizhub.service.CategoryService categoryService;
    private final QuestionService questionService;

    // Helper

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
    }

    private Category resolveCategory(Long categoryId) {
        if (categoryId == null || categoryId == -1L) return null;
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));
    }

    private Category resolveAndValidateCategory(Long categoryId, User currentUser) {
        Category category = resolveCategory(categoryId);
        if (category != null) {
            boolean isAdmin = currentUser.getRole().name().equalsIgnoreCase("ADMIN");
            if (!isAdmin) {
                if (category.getCreator() == null || !category.getCreator().getId().equals(currentUser.getId())) {
                    throw new AppException(ErrorCode.UNAUTHORIZED);
                }
            }
        }
        return category;
    }

    private Quiz findQuiz(String id) {
        return quizRepository.findById(UUID.fromString(id))
                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_NOT_FOUND));
    }

    private boolean hasEverBeenAssigned(Quiz quiz) {
        return quizAssigningRepository.countAnyByQuizIdIncludingDeleted(quiz.getId()) > 0;
    }

    private boolean hasEverBeenTaken(Quiz quiz) {
        return !quizTakingRepository.findByQuizId(quiz.getId()).isEmpty();
    }

    private boolean hasSameQuestionMembership(Quiz quiz, List<Long> requestedQuestionIds) {
        if (quiz.getQuestions() == null || requestedQuestionIds == null) {
            return quiz.getQuestions() == null && requestedQuestionIds == null;
        }

        Set<Long> currentQuestionIds = quiz.getQuestions().stream()
                .map(Question::getId)
                .collect(Collectors.toCollection(HashSet::new));
        Set<Long> requestedIds = new HashSet<>(requestedQuestionIds);

        return currentQuestionIds.size() == requestedQuestionIds.size()
                && requestedIds.size() == requestedQuestionIds.size()
                && currentQuestionIds.equals(requestedIds);
    }

    // API

    @Override
    @Transactional
    public QuizResponseDTO createNewQuiz(QuizRequestDTO request) {
        User currentUser = getCurrentUser();
        Quiz quiz = quizMapper.toEntity(request);
        quiz.setCreator(currentUser);
        quiz.setCategory(resolveAndValidateCategory(request.getCategoryId(), currentUser));
        quiz.setIsEnable(true);

        List<Question> questions = questionRepository.findAllById(request.getQuestionIds());

        if (questions.size() != request.getQuestionIds().size()) {
            throw new AppException(ErrorCode.QUESTION_NOT_FOUND);
        }

        quiz.setQuestions(questions);
        // Khi gọi save(), Hibernate sẽ tự động chèn data vào bảng trung gian _question_creating
        return quizMapper.toResponseDTO(quizRepository.save(quiz));
    }

    @Override
    @Transactional
    public QuizResponseDTO bulkCreateQuiz(BulkQuizCreateRequestDTO request) {
        User currentUser = getCurrentUser();
        Category category = resolveAndValidateCategory(request.getCategoryId(), currentUser);

        // Phase 1: Batch create all questions and harvest IDs
        List<Long> questionIds = new ArrayList<>();
        for (QuestionRequestDTO qDto : request.getQuestions()) {
            // Force correct category onto raw questions to match parent quiz choice if blank
            if (qDto.getCategoryId() == null && category != null) {
                qDto.setCategoryId(category.getId());
            }
            QuestionResponseDTO savedQ = questionService.createNewQuestion(currentUser.getId(), qDto);
            questionIds.add(savedQ.getId());
        }

        // Phase 2: Create Quiz using standard entity assembly
        Quiz quiz = Quiz.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .category(category)
                .creator(currentUser)
                .isDraft(false)
                .isExam(false)
                .isEnable(true)
                .build();

        List<Question> questions = questionRepository.findAllById(questionIds);
        quiz.setQuestions(questions);

        return quizMapper.toResponseDTO(quizRepository.save(quiz));
    }

    @Override
    @Transactional(readOnly = true)
    public QuizResponseDTO getQuizById(String id) {
        return quizMapper.toResponseDTO(findQuiz(id));
    }

    @Override
    @Transactional
    public QuizResponseDTO updateQuiz(String id, QuizRequestDTO request) {
        Quiz quiz = findQuiz(id);
        User currentUser = getCurrentUser();
        boolean isAdmin = currentUser.getRole().name().equalsIgnoreCase("ADMIN");

        if(!isAdmin && !quiz.getCreator().getId().equals(currentUser.getId())){
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        List<Question> questions = questionRepository.findAllById(request.getQuestionIds());
        if (questions.size() != request.getQuestionIds().size()) {
            throw new AppException(ErrorCode.QUESTION_NOT_FOUND);
        }

        boolean assignedBefore = hasEverBeenAssigned(quiz);
        boolean takenBefore = hasEverBeenTaken(quiz);
        
        if (assignedBefore || takenBefore) {
            // Soft delete old quiz
            quiz.setIsEnable(false);
            quizRepository.save(quiz);

            // Create new clone quiz with updated data
            Quiz clone = Quiz.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .isDraft(request.getIsDraft())
                .isExam(request.getIsExam())
                .category(resolveAndValidateCategory(request.getCategoryId(), currentUser))
                .creator(quiz.getCreator())
                .isEnable(true)
                .questions(questions)
                .build();
            return quizMapper.toResponseDTO(quizRepository.save(clone));
        } else {
            // Update in-place if not assigned
            quiz.setTitle(request.getTitle());
            quiz.setDescription(request.getDescription());
            quiz.setImageUrl(request.getImageUrl());
            quiz.setIsDraft(request.getIsDraft());
            quiz.setIsExam(request.getIsExam());
            quiz.setCategory(resolveAndValidateCategory(request.getCategoryId(), currentUser));
            quiz.getQuestions().clear();
            quiz.getQuestions().addAll(questions);
            return quizMapper.toResponseDTO(quizRepository.save(quiz));
        }
    }


    @Override
    @Transactional
    public void deleteQuiz(String id) {
        Quiz quiz = findQuiz(id);
        User currentUser = getCurrentUser();
        boolean isAdmin = currentUser.getRole().name().equalsIgnoreCase("ADMIN");

        if(!isAdmin && !quiz.getCreator().getId().equals(currentUser.getId())){
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }

        // Soft delete
        quiz.setIsEnable(false);
        quizRepository.save(quiz);
    }

    @Override
    public List<QuizSummaryDTO> getPublicQuizzesByCategoryId(Long categoryId) {
        List<Long> allIds = categoryService.getAllDescendantIds(categoryId);
        return quizRepository
                .findByCategoryIdInAndIsDraftFalseAndIsEnableTrue(allIds)
                .stream()
                .map(QuizSummaryDTO::new)
                .collect(Collectors.toList());
    }

    @Override
    public List<QuizSummaryDTO> getMyQuizzesByCategoryId(Long categoryId) {
        User user = getCurrentUser();
        List<Long> allIds = categoryService.getAllDescendantIds(categoryId);
        return quizRepository
                .findByCategoryIdInAndCreatorIdAndIsEnableTrue(allIds, user.getId())
                .stream()
                .map(q -> mapToSummaryDTO(q, user))
                .collect(Collectors.toList());
    }

    @Override
    public List<QuizSummaryDTO> getMyQuizzes() {
        User user = getCurrentUser();
        return quizRepository
                .findByCreatorIdAndIsEnableTrue(user.getId())
                .stream()
                .map(q -> mapToSummaryDTO(q, user))
                .collect(Collectors.toList());
    }

    private QuizSummaryDTO mapToSummaryDTO(Quiz quiz, User user) {
        QuizSummaryDTO dto = new QuizSummaryDTO(quiz);

        // Find personal taking info (where quizAssigning is null)
        quizTakingRepository.findByLearnerIdAndQuizIdAndQuizAssigningIsNull(user.getId(), quiz.getId())
                .stream().findFirst().ifPresent(qt -> {
                    dto.setTakingStatus(qt.getStatus().name());
                    long attempts = attemptRepository.countByQuizTakingIdAndEndedAtIsNotNull(qt.getId());
                    dto.setAttemptInfo("Lần làm: " + attempts);
                });

        return dto;
    }

    @Override
    @Transactional
    public QuizResponseDTO generateQuizFromCategory(QuizGenerateRequestDTO request) {
        Category category = resolveCategory(request.getCategoryId());
        List<Long> allIds = categoryService.getAllDescendantIds(request.getCategoryId());

        Long currentUserId = getCurrentUser().getId();
        List<Long> questionIds = questionRepository.findValidQuestionIdsForGeneration(allIds, currentUserId);
        if (questionIds.isEmpty()) {
            throw new AppException(ErrorCode.QUESTION_NOT_FOUND); // No questions available
        }

        List<Long> selectedIds;
        if ("RANDOM".equalsIgnoreCase(request.getMethod())) {
            int amount = request.getAmount() != null ? request.getAmount() : 40;
            Collections.shuffle(questionIds);
            selectedIds = questionIds.stream().limit(amount).collect(Collectors.toList());
        } else if ("RANGE".equalsIgnoreCase(request.getMethod())) {
            int offset = request.getOffset() != null ? request.getOffset() : 0;
            int limit = request.getLimit() != null ? request.getLimit() : 40;
            selectedIds = questionIds.stream().skip(offset).limit(limit).collect(Collectors.toList());
        } else {
            throw new AppException(ErrorCode.INVALID_GENERATION_METHOD);
        }

        if (selectedIds.isEmpty()) {
            throw new AppException(ErrorCode.QUESTION_NOT_FOUND);
        }

        List<Question> questions = questionRepository.findAllById(selectedIds);

        Quiz quiz = Quiz.builder()
                .title(request.getTitle())
                .description("Generated from category: " + category.getName())
                .isDraft(false)
                .isEnable(true)
                .isExam(false)
                .category(null)
                .creator(getCurrentUser())
                .questions(questions)
                .build();

        return quizMapper.toResponseDTO(quizRepository.save(quiz));
    }

    // ─── EXPORT EXCEL ────────────────────────────────────────────────────────────

    @Override
    public byte[] exportQuizToExcel(String quizId) {
        Quiz quiz = findQuiz(quizId);

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            XSSFSheet sheet = workbook.createSheet("Câu hỏi");

            // ── Styling ──────────────────────────────────────────────────────────
            // Header style
            XSSFCellStyle headerStyle = workbook.createCellStyle();
            XSSFFont headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte)59, (byte)130, (byte)246}, null)); // Blue-500
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);
            headerStyle.setWrapText(true);

            // Data style
            XSSFCellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            dataStyle.setWrapText(true);

            // Correct answer cell style (light green)
            XSSFCellStyle correctStyle = workbook.createCellStyle();
            correctStyle.cloneStyleFrom(dataStyle);
            correctStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte)220, (byte)252, (byte)231}, null)); // green-100
            correctStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            XSSFFont boldFont = workbook.createFont();
            boldFont.setBold(true);
            correctStyle.setFont(boldFont);
            correctStyle.setAlignment(HorizontalAlignment.CENTER);

            // ── Row 0: Tiêu đề đề thi (merge toàn bộ 12 cột) ────────────────────
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(24);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("📋 " + (quiz.getTitle() != null ? quiz.getTitle() : "Đề thi"));
            XSSFCellStyle titleStyle = workbook.createCellStyle();
            XSSFFont titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 13);
            titleStyle.setFont(titleFont);
            titleStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte)238, (byte)242, (byte)255}, null)); // indigo-50
            titleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 11));

            // ── Row 1: Header cột ─────────────────────────────────────────────────
            String[] headers = {
                "Nội dung câu hỏi",  // A
                "Loại câu hỏi",      // B
                "Mức độ",            // C
                "Đáp án A",          // D
                "Đáp án B",          // E
                "Đáp án C",          // F
                "Đáp án D",          // G
                "Đáp án E",          // H
                "Đáp án F",          // I
                "Đáp án G",          // J
                "Đáp án H",          // K
                "Đáp án đúng"        // L
            };
            Row headerRow = sheet.createRow(1);
            headerRow.setHeightInPoints(22);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // ── Row 2+: Dữ liệu từng câu hỏi ─────────────────────────────────────
            List<com.example.quizhub.entity.Question> questions = quiz.getQuestions();
            if (questions != null) {
                for (int rowIdx = 0; rowIdx < questions.size(); rowIdx++) {
                    com.example.quizhub.entity.Question q = questions.get(rowIdx);
                    Row row = sheet.createRow(rowIdx + 2);
                    row.setHeightInPoints(18);

                    // Col A: Nội dung câu hỏi
                    Cell cellText = row.createCell(0);
                    cellText.setCellValue(q.getText() != null ? q.getText() : "");
                    cellText.setCellStyle(dataStyle);

                    // Col B: Loại câu hỏi
                    Cell cellType = row.createCell(1);
                    String typeStr;
                    if (q.getType() == null) {
                        typeStr = "trắc nghiệm";
                    } else {
                        typeStr = switch (q.getType()) {
                            case MULTIPLE_CHOICE -> "chọn nhiều";
                            case FILL_IN_BLANK   -> "điền khuyết";
                            default              -> "trắc nghiệm";
                        };
                    }
                    cellType.setCellValue(typeStr);
                    cellType.setCellStyle(dataStyle);

                    // Col C: Mức độ
                    Cell cellLevel = row.createCell(2);
                    String levelStr;
                    if (q.getLevel() == null) {
                        levelStr = "trung bình";
                    } else {
                        levelStr = switch (q.getLevel()) {
                            case EASY -> "dễ";
                            case HARD -> "khó";
                            default   -> "trung bình";
                        };
                    }
                    cellLevel.setCellValue(levelStr);
                    cellLevel.setCellStyle(dataStyle);

                    // Col D→K: Các phương án đáp án
                    List<com.example.quizhub.entity.Answer> answers = q.getAnswers();
                    StringBuilder correctLetters = new StringBuilder();

                    if (answers != null) {
                        for (int aIdx = 0; aIdx < Math.min(answers.size(), 8); aIdx++) {
                            com.example.quizhub.entity.Answer ans = answers.get(aIdx);
                            Cell ansCell = row.createCell(3 + aIdx); // D=3, E=4, ...
                            ansCell.setCellValue(ans.getText() != null ? ans.getText() : "");
                            ansCell.setCellStyle(dataStyle);

                            // Ghi nhận đáp án đúng
                            if (Boolean.TRUE.equals(ans.getIsCorrect())) {
                                if (!correctLetters.isEmpty()) correctLetters.append(",");
                                correctLetters.append((char) ('A' + aIdx));
                            }
                        }
                    }

                    // Col L: Đáp án đúng (để trống nếu điền khuyết)
                    Cell cellCorrect = row.createCell(11);
                    boolean isFillInBlank = q.getType() != null &&
                        q.getType() == com.example.quizhub.entity.enums.QuestionType.FILL_IN_BLANK;
                    if (!isFillInBlank) {
                        cellCorrect.setCellValue(correctLetters.toString());
                    }
                    cellCorrect.setCellStyle(correctStyle);
                }
            }

            // ── Column widths ──────────────────────────────────────────────────────
            sheet.setColumnWidth(0, 14000);  // A: Nội dung câu hỏi
            sheet.setColumnWidth(1, 4000);   // B: Loại
            sheet.setColumnWidth(2, 3500);   // C: Mức độ
            for (int i = 3; i <= 10; i++) {
                sheet.setColumnWidth(i, 5500); // D–K: Đáp án
            }
            sheet.setColumnWidth(11, 3500);  // L: Đáp án đúng

            // Freeze header rows
            sheet.createFreezePane(0, 2);

            workbook.write(out);
            return out.toByteArray();

        } catch (IOException e) {
            throw new com.example.quizhub.exception.AppException(
                com.example.quizhub.exception.ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }
}


package com.example.quizhub.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.quizhub.dto.practice.PracticeAnswerRequestDTO;
import com.example.quizhub.dto.practice.PracticeAnswerResponseDTO;
import com.example.quizhub.dto.practice.PracticeDetailResponseDTO;
import com.example.quizhub.dto.practice.PracticeHistoryResponseDTO;
import com.example.quizhub.dto.practice.PracticeQuestionResponseDTO;
import com.example.quizhub.dto.practice.PracticeResultResponseDTO;
import com.example.quizhub.dto.practice.PracticeStartRequestDTO;
import com.example.quizhub.dto.practice.PracticeStartResponseDTO;
import com.example.quizhub.dto.practice.PracticeSubmitRequestDTO;
import com.example.quizhub.entity.Answer;
import com.example.quizhub.entity.Category;
import com.example.quizhub.entity.Practice;
import com.example.quizhub.entity.PracticeDetail;
import com.example.quizhub.entity.Question;
import com.example.quizhub.entity.Quiz;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.QuestionStatus;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.AnswerRepository;
import com.example.quizhub.repository.CategoryRepository;
import com.example.quizhub.repository.PracticeDetailRepository;
import com.example.quizhub.repository.PracticeRepository;
import com.example.quizhub.repository.QuestionRepository;
import com.example.quizhub.repository.QuizRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.service.CategoryService;
import com.example.quizhub.service.PracticeService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PracticeServiceImpl implements PracticeService {

        private final PracticeRepository practiceRepository;
        private final PracticeDetailRepository practiceDetailRepository;
        private final QuestionRepository questionRepository;
        private final AnswerRepository answerRepository;
        private final CategoryRepository categoryRepository;
        private final UserRepository userRepository;
        private final QuizRepository quizRepository;
        private final CategoryService categoryService;

        private User getCurrentUser() {
                String email = SecurityContextHolder.getContext().getAuthentication().getName();
                return userRepository.findByEmail(email)
                                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        }

        private String getCategoryFullPath(Category category) {
                if (category == null) return "Đề thi cá nhân";
                List<String> names = new ArrayList<>();
                Category current = category;
                while (current != null) {
                        names.add(0, current.getName());
                        current = current.getParent();
                }
                return String.join(" > ", names);
        }

        @Override
        @Transactional
        public PracticeStartResponseDTO startPractice(PracticeStartRequestDTO request) {
                User user = getCurrentUser();
                Category category = categoryRepository.findById(request.getCategoryId())
                                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

                List<Long> categoryIds = categoryService.getAllDescendantIds(request.getCategoryId());

                Integer limit = request.getLimit() != null ? request.getLimit() : 10;
                Integer offset = request.getOffset() != null ? request.getOffset() : 0;
                boolean isRandom = Boolean.TRUE.equals(request.getIsRandom());

                Practice practice;
                List<Question> questions;

                if (isRandom) {
                        // Always create a NEW random set (no resume from this path)
                        questions = questionRepository.findRandomPublicQuestionsByCategories(categoryIds, limit);
                        if (questions.isEmpty()) {
                                throw new AppException(ErrorCode.QUESTION_NOT_FOUND);
                        }

                        practice = Practice.builder()
                                        .user(user)
                                        .category(category)
                                        .totalQuestions(questions.size())
                                        .isRandom(true)
                                        .isCompleted(false)
                                        .build();
                        practice = practiceRepository.save(practice);

                        // Lock these questions by saving PracticeDetail immediately
                        for (Question q : questions) {
                                PracticeDetail detail = PracticeDetail.builder()
                                                .practice(practice)
                                                .question(q)
                                                .build();
                                practiceDetailRepository.save(detail);
                        }
                } else {
                        // 2. Sequential Logic (Range-based)
                        Pageable pageable = PageRequest.of(offset / limit, limit);
                        questions = questionRepository.findPublicQuestionsByCategories(categoryIds, pageable);

                        if (questions.isEmpty()) {
                                throw new AppException(ErrorCode.QUESTION_NOT_FOUND);
                        }

                        int actualCount = questions.size();
                        boolean forceNew = Boolean.TRUE.equals(request.getForceNew());

                        if (forceNew) {
                                Practice newPractice = Practice.builder()
                                                .user(user)
                                                .category(category)
                                                .practiceLimit(limit)
                                                .practiceOffset(offset)
                                                .totalQuestions(actualCount)
                                                .isRandom(false)
                                                .isCompleted(false)
                                                .build();
                                practice = practiceRepository.save(newPractice);
                        } else {
                                if (request.getPracticeId() != null) {
                                        practice = practiceRepository.findById(request.getPracticeId())
                                                        .orElseThrow(() -> new AppException(
                                                                        ErrorCode.PRACTICE_NOT_FOUND));
                                } else {
                                        practice = practiceRepository
                                                        .findFirstByUserIdAndCategoryIdAndPracticeLimitAndPracticeOffsetAndIsRandomAndIsCompletedFalseOrderByCreatedAtDesc(
                                                                        user.getId(), category.getId(), limit, offset,
                                                                        false)
                                                        .orElseGet(() -> {
                                                                Practice newPractice = Practice.builder()
                                                                                .user(user)
                                                                                .category(category)
                                                                                .practiceLimit(limit)
                                                                                .practiceOffset(offset)
                                                                                .totalQuestions(actualCount)
                                                                                .isRandom(false)
                                                                                .isCompleted(false)
                                                                                .build();
                                                                return practiceRepository.save(newPractice);
                                                        });
                                }
                        }

                        if (!practice.getTotalQuestions().equals(actualCount)) {
                                practice.setTotalQuestions(actualCount);
                                practiceRepository.save(practice);
                        }
                }

                // Map to safe DTO with progress
                final Practice finalPractice = practice;
                List<PracticeQuestionResponseDTO> questionDTOs = questions.stream().map(q -> {
                        List<PracticeAnswerResponseDTO> answers = q.getAnswers().stream()
                                        .map(a -> new PracticeAnswerResponseDTO(a.getId(), a.getText(),
                                                        a.getIsCorrect()))
                                        .collect(Collectors.toList());

                        // Load saved progress for this question in this practice
                        PracticeDetail detail = practiceDetailRepository
                                        .findFirstByPracticeIdAndQuestionIdOrderByIdAsc(finalPractice.getId(),
                                                        q.getId())
                                        .orElse(null);

                        return PracticeQuestionResponseDTO.builder()
                                        .id(q.getId())
                                        .text(q.getText())
                                        .type(q.getType())
                                        .level(q.getLevel())
                                        .answers(answers)
                                        .selectedAnswerIds(detail != null && detail.getSelectedAnswers() != null
                                                        ? detail.getSelectedAnswers().stream().map(Answer::getId)
                                                                        .collect(Collectors.toList())
                                                        : null)
                                        .selectedText(detail != null ? detail.getSelectedText() : null)
                                        .isCorrect(detail != null ? detail.getIsCorrect() : null)
                                        .build();
                }).collect(Collectors.toList());

                return PracticeStartResponseDTO.builder()
                                .questions(questionDTOs)
                                .practiceId(practice.getId())
                                .categoryId(category.getId())
                                .categoryName(getCategoryFullPath(category))
                                .build();
        }

        @Override
        @Transactional
        public void saveAnswer(Long practiceId, PracticeAnswerRequestDTO ansReq) {
                Practice practice = practiceRepository.findById(practiceId)
                                .orElseThrow(() -> new AppException(ErrorCode.PRACTICE_NOT_FOUND));

                if (Boolean.TRUE.equals(practice.getIsCompleted())) {
                        throw new AppException(ErrorCode.PRACTICE_ALREADY_SUBMITTED);
                }

                Question question = questionRepository.findById(ansReq.getQuestionId())
                                .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));

                PracticeDetail detail = practiceDetailRepository
                                .findFirstByPracticeIdAndQuestionIdOrderByIdAsc(practiceId, ansReq.getQuestionId())
                                .orElse(PracticeDetail.builder()
                                                .practice(practice)
                                                .question(question)
                                                .build());

                List<Answer> selectedAnswers = new ArrayList<>();
                String selectedText = ansReq.getSelectedText();
                boolean isCorrect = false;

                List<Long> correctAnswerIds = question.getAnswers().stream()
                                .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                                .map(Answer::getId)
                                .collect(Collectors.toList());
                List<String> correctTexts = question.getAnswers().stream()
                                .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                                .map(Answer::getText)
                                .collect(Collectors.toList());

                switch (question.getType()) {
                        case SINGLE_CHOICE:
                                if (ansReq.getSelectedAnswerId() != null) {
                                        Answer sa = answerRepository.findById(ansReq.getSelectedAnswerId())
                                                        .orElse(null);
                                        if (sa != null) {
                                                selectedAnswers.add(sa);
                                                if (Boolean.TRUE.equals(sa.getIsCorrect())) {
                                                        isCorrect = true;
                                                }
                                        }
                                }
                                break;
                        case MULTIPLE_CHOICE:
                                if (ansReq.getSelectedAnswerIds() != null && !ansReq.getSelectedAnswerIds().isEmpty()) {
                                        List<Answer> sas = answerRepository.findAllById(ansReq.getSelectedAnswerIds());
                                        selectedAnswers.addAll(sas);

                                        List<Long> saIds = sas.stream().map(Answer::getId).sorted()
                                                        .collect(Collectors.toList());
                                        List<Long> caIds = correctAnswerIds.stream().sorted()
                                                        .collect(Collectors.toList());
                                        if (saIds.equals(caIds)) {
                                                isCorrect = true;
                                        }
                                }
                                break;
                        case FILL_IN_BLANK:
                                if (selectedText != null && !selectedText.trim().isEmpty()) {
                                        String trimmedSelected = selectedText.trim();
                                        for (String ct : correctTexts) {
                                                if (ct.trim().equalsIgnoreCase(trimmedSelected)) {
                                                        isCorrect = true;
                                                        break;
                                                }
                                        }
                                }
                                break;
                }

                detail.setSelectedAnswers(selectedAnswers);
                detail.setSelectedText(selectedText);
                detail.setIsCorrect(isCorrect);

                practiceDetailRepository.save(detail);
        }

        @Override
        @Transactional(readOnly = true)
        public List<PracticeQuestionResponseDTO> previewPractice(PracticeStartRequestDTO request) {
                Category category = categoryRepository.findById(request.getCategoryId())
                                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

                List<Long> categoryIds = categoryService.getAllDescendantIds(request.getCategoryId());

                Integer limit = request.getLimit() != null ? request.getLimit() : 10;
                Integer offset = request.getOffset() != null ? request.getOffset() : 0;
                boolean isRandom = Boolean.TRUE.equals(request.getIsRandom());

                List<Question> questions;
                if (isRandom) {
                        questions = questionRepository.findRandomPublicQuestionsByCategories(categoryIds, limit);
                } else {
                        Pageable pageable = PageRequest.of(offset / limit, limit);
                        questions = questionRepository.findPublicQuestionsByCategories(categoryIds, pageable);
                }

                if (questions.isEmpty()) {
                        throw new AppException(ErrorCode.QUESTION_NOT_FOUND);
                }

                // Map with isCorrect for preview
                return questions.stream().map(q -> {
                        List<PracticeAnswerResponseDTO> answers = q.getAnswers().stream()
                                        .map(a -> new PracticeAnswerResponseDTO(a.getId(), a.getText(),
                                                        a.getIsCorrect()))
                                        .collect(Collectors.toList());

                        return PracticeQuestionResponseDTO.builder()
                                        .id(q.getId())
                                        .text(q.getText())
                                        .type(q.getType())
                                        .level(q.getLevel())
                                        .answers(answers)
                                        .build();
                }).collect(Collectors.toList());
        }

        @Override
        @Transactional
        public PracticeResultResponseDTO submitPractice(PracticeSubmitRequestDTO request) {
                User user = getCurrentUser();
                Category category = categoryRepository.findById(request.getCategoryId())
                                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

                // Try to find the existing practice first
                Integer limit = request.getAnswers().size();
                Integer offset = 0; // Default if not provided in submit, or we can use practiceId if passed

                Practice practice;
                if (request.getPracticeId() != null) {
                        practice = practiceRepository.findById(request.getPracticeId())
                                        .orElseThrow(() -> new AppException(ErrorCode.PRACTICE_NOT_FOUND));
                } else {
                        practice = practiceRepository
                                        .findFirstByUserIdAndCategoryIdAndPracticeLimitAndPracticeOffsetAndIsRandomAndIsCompletedFalseOrderByCreatedAtDesc(
                                                        user.getId(), category.getId(), limit, offset, false)
                                        .orElseGet(() -> Practice.builder()
                                                        .user(user)
                                                        .category(category)
                                                        .totalQuestions(limit)
                                                        .correctAnswers(0)
                                                        .isCompleted(false)
                                                        .build());
                }

                Practice savedPractice = practiceRepository.save(practice);
                List<PracticeDetailResponseDTO> detailResponses = new ArrayList<>();
                int correctCount = 0;
                int totalQuestions = savedPractice.getTotalQuestions();

                for (PracticeAnswerRequestDTO ansReq : request.getAnswers()) {
                        Question question = questionRepository.findById(ansReq.getQuestionId())
                                        .orElseThrow(() -> new AppException(ErrorCode.QUESTION_NOT_FOUND));

                        List<Answer> selectedAnswers = new ArrayList<>();
                        String selectedText = ansReq.getSelectedText();
                        boolean isCorrect = false;

                        List<Long> correctAnswerIds = question.getAnswers().stream()
                                        .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                                        .map(Answer::getId)
                                        .collect(Collectors.toList());
                        List<String> correctTexts = question.getAnswers().stream()
                                        .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                                        .map(Answer::getText)
                                        .collect(Collectors.toList());

                        switch (question.getType()) {
                                case SINGLE_CHOICE:
                                        if (ansReq.getSelectedAnswerId() != null) {
                                                Answer sa = answerRepository.findById(ansReq.getSelectedAnswerId())
                                                                .orElse(null);
                                                if (sa != null) {
                                                        selectedAnswers.add(sa);
                                                        if (Boolean.TRUE.equals(sa.getIsCorrect())) {
                                                                isCorrect = true;
                                                        }
                                                }
                                        }
                                        break;
                                case MULTIPLE_CHOICE:
                                        if (ansReq.getSelectedAnswerIds() != null
                                                        && !ansReq.getSelectedAnswerIds().isEmpty()) {
                                                List<Answer> sas = answerRepository
                                                                .findAllById(ansReq.getSelectedAnswerIds());
                                                selectedAnswers.addAll(sas);

                                                List<Long> saIds = sas.stream().map(Answer::getId).sorted()
                                                                .collect(Collectors.toList());
                                                List<Long> caIds = correctAnswerIds.stream().sorted()
                                                                .collect(Collectors.toList());
                                                if (saIds.equals(caIds)) {
                                                        isCorrect = true;
                                                }
                                        }
                                        break;
                                case FILL_IN_BLANK:
                                        if (selectedText != null && !selectedText.trim().isEmpty()) {
                                                String trimmedSelected = selectedText.trim();
                                                for (String ct : correctTexts) {
                                                        if (ct.trim().equalsIgnoreCase(trimmedSelected)) {
                                                                isCorrect = true;
                                                                break;
                                                        }
                                                }
                                        }
                                        break;
                        }

                        if (isCorrect) {
                                correctCount++;
                        }

                        // Save or update detail
                        PracticeDetail detail = practiceDetailRepository
                                        .findFirstByPracticeIdAndQuestionIdOrderByIdAsc(savedPractice.getId(),
                                                        question.getId())
                                        .orElse(PracticeDetail.builder()
                                                        .practice(savedPractice)
                                                        .question(question)
                                                        .build());

                        detail.setSelectedAnswers(selectedAnswers);
                        detail.setSelectedText(selectedText);
                        detail.setIsCorrect(isCorrect);
                        practiceDetailRepository.save(detail);

                        // Add to response
                        detailResponses.add(PracticeDetailResponseDTO.builder()
                                        .questionId(question.getId())
                                        .questionText(question.getText())
                                        .selectedAnswerIds(selectedAnswers.stream().map(Answer::getId)
                                                        .collect(Collectors.toList()))
                                        .selectedText(selectedText)
                                        .correctAnswerIds(correctAnswerIds)
                                        .correctTexts(correctTexts)
                                        .isCorrect(isCorrect)
                                        .questionType(question.getType().name())
                                        .questionLevel(question.getLevel().name())
                                        .answers(question.getAnswers().stream()
                                                        .map(a -> new PracticeAnswerResponseDTO(a.getId(), a.getText(),
                                                                        a.getIsCorrect()))
                                                        .collect(Collectors.toList()))
                                        .build());
                }

                savedPractice.setCorrectAnswers(correctCount);
                savedPractice.setIsCompleted(true);
                practiceRepository.save(savedPractice);

                return PracticeResultResponseDTO.builder()
                                .practiceId(savedPractice.getId())
                                .categoryName(getCategoryFullPath(category))
                                .totalQuestions(totalQuestions)
                                .correctAnswers(correctCount)
                                .score(BigDecimal.valueOf((correctCount * 10.0) / totalQuestions)
                                                .setScale(1, RoundingMode.HALF_UP))
                                .createdAt(savedPractice.getCreatedAt())
                                .details(detailResponses)
                                .build();
        }

        @Override
        @Transactional(readOnly = true)
        public long countQuestions(Long categoryId) {
                categoryRepository.findById(categoryId)
                                .orElseThrow(() -> new AppException(ErrorCode.CATEGORY_NOT_FOUND));

                List<Long> categoryIds = categoryService.getAllDescendantIds(categoryId);

                return questionRepository.countPublicQuestionsByCategories(categoryIds, QuestionStatus.PUBLIC);
        }

        @Override
        @Transactional(readOnly = true)
        public List<PracticeHistoryResponseDTO> getPracticeHistory(Long categoryId) {
                User user = getCurrentUser();
                // Return ALL practices (completed + incomplete) so students can resume
                List<Practice> practices = practiceRepository.findByUserIdAndCategoryIdOrderByCreatedAtDesc(
                                user.getId(), categoryId);

                return practices.stream().map(p -> PracticeHistoryResponseDTO.builder()
                                .id(p.getId())
                                .categoryId(p.getCategory().getId())
                                .categoryName(getCategoryFullPath(p.getCategory()))
                                .totalQuestions(p.getTotalQuestions())
                                .correctAnswers(p.getCorrectAnswers())
                                .answeredQuestions((int) practiceDetailRepository.countAnsweredByPracticeId(p.getId()))
                                .createdAt(p.getCreatedAt())
                                .isCompleted(p.getIsCompleted())
                                .isRandom(p.getIsRandom())
                                .practiceLimit(p.getPracticeLimit())
                                .practiceOffset(p.getPracticeOffset())
                                .build()).collect(Collectors.toList());
        }

        @Override
        @Transactional(readOnly = true)
        public List<PracticeHistoryResponseDTO> getMyPracticeHistory() {
                User user = getCurrentUser();
                List<Practice> practices = practiceRepository
                                .findByUserIdOrderByCreatedAtDesc(user.getId());

                return practices.stream().map(p -> PracticeHistoryResponseDTO.builder()
                                .id(p.getId())
                                .categoryId(p.getCategory() != null ? p.getCategory().getId() : null)
                                .categoryName(getCategoryFullPath(p.getCategory()))
                                .totalQuestions(p.getTotalQuestions())
                                .correctAnswers(p.getCorrectAnswers())
                                .answeredQuestions((int) practiceDetailRepository.countAnsweredByPracticeId(p.getId()))
                                .createdAt(p.getCreatedAt())
                                .isCompleted(p.getIsCompleted())
                                .isRandom(p.getIsRandom())
                                .practiceLimit(p.getPracticeLimit())
                                .practiceOffset(p.getPracticeOffset())
                                .build()).collect(Collectors.toList());
        }

        @Override
        @Transactional(readOnly = true)
        public PracticeResultResponseDTO getPracticeDetail(Long practiceId) {
                User user = getCurrentUser();
                Practice practice = practiceRepository.findById(practiceId)
                                .orElseThrow(() -> new AppException(ErrorCode.PRACTICE_NOT_FOUND));

                // Check ownership
                if (!practice.getUser().getId().equals(user.getId())) {
                        throw new AppException(ErrorCode.UNAUTHORIZED);
                }

                List<PracticeDetailResponseDTO> details = practice.getDetails().stream()
                                .sorted(Comparator.comparingLong(d -> d.getId()))
                                .map(d -> PracticeDetailResponseDTO.builder()
                                                .questionId(d.getQuestion().getId())
                                                .questionText(d.getQuestion().getText())
                                                .selectedAnswerIds(d.getSelectedAnswers() != null
                                                                ? d.getSelectedAnswers().stream().map(Answer::getId)
                                                                                .collect(Collectors.toList())
                                                                : null)
                                                .selectedText(d.getSelectedText())
                                                .correctAnswerIds(d.getQuestion().getAnswers().stream()
                                                                .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                                                                .map(Answer::getId)
                                                                .collect(Collectors.toList()))
                                                .correctTexts(d.getQuestion().getAnswers().stream()
                                                                .filter(a -> Boolean.TRUE.equals(a.getIsCorrect()))
                                                                .map(Answer::getText)
                                                                .collect(Collectors.toList()))
                                                .isCorrect(d.getIsCorrect())
                                                .questionType(d.getQuestion().getType().name())
                                                .questionLevel(d.getQuestion().getLevel().name())
                                                .answers(d.getQuestion().getAnswers().stream()
                                                                .map(a -> new PracticeAnswerResponseDTO(a.getId(),
                                                                                a.getText(), a.getIsCorrect()))
                                                                .collect(Collectors.toList()))
                                                .build())
                                .collect(Collectors.toList());

                return PracticeResultResponseDTO.builder()
                                .practiceId(practice.getId())
                                .categoryName(getCategoryFullPath(practice.getCategory()))
                                .totalQuestions(practice.getTotalQuestions())
                                .correctAnswers(practice.getCorrectAnswers())
                                .score(BigDecimal
                                                .valueOf((practice.getCorrectAnswers() * 10.0)
                                                                / practice.getTotalQuestions())
                                                .setScale(1, RoundingMode.HALF_UP))
                                .createdAt(practice.getCreatedAt())
                                .details(details)
                                .build();
        }

        @Override
        @Transactional(readOnly = true)
        public PracticeStartResponseDTO startPracticeFromQuiz(String quizId) {
                Quiz quiz = quizRepository.findById(UUID.fromString(quizId))
                                .orElseThrow(() -> new AppException(ErrorCode.QUIZ_NOT_FOUND));

                List<Question> questions = quiz.getQuestions();

                if (questions.isEmpty()) {
                        throw new AppException(ErrorCode.QUESTION_NOT_FOUND);
                }

                List<PracticeQuestionResponseDTO> questionDTOs = questions.stream().map(q -> {
                        List<PracticeAnswerResponseDTO> answers = q.getAnswers().stream()
                                        .map(a -> new PracticeAnswerResponseDTO(a.getId(), a.getText(),
                                                        a.getIsCorrect()))
                                        .collect(Collectors.toList());

                        return PracticeQuestionResponseDTO.builder()
                                        .id(q.getId())
                                        .text(q.getText())
                                        .type(q.getType())
                                        .level(q.getLevel())
                                        .answers(answers)
                                        .build();
                }).collect(Collectors.toList());

                return PracticeStartResponseDTO.builder()
                                .questions(questionDTOs)
                                .categoryId(quiz.getCategory() != null ? quiz.getCategory().getId() : null)
                                .categoryName(getCategoryFullPath(quiz.getCategory()))
                                .quizTitle(quiz.getTitle())
                                .build();
        }
}

package com.example.quizhub.controller.student.rest;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.practice.PracticeAnswerRequestDTO;
import com.example.quizhub.dto.practice.PracticeHistoryResponseDTO;
import com.example.quizhub.dto.practice.PracticeQuestionResponseDTO;
import com.example.quizhub.dto.practice.PracticeResultResponseDTO;
import com.example.quizhub.dto.practice.PracticeStartRequestDTO;
import com.example.quizhub.dto.practice.PracticeStartResponseDTO;
import com.example.quizhub.dto.practice.PracticeSubmitRequestDTO;
import com.example.quizhub.service.PracticeService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/student/practice")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
public class StudentPracticeRestController {

    private final PracticeService practiceService;

    @PostMapping("/start")
    public ResponseEntity<PracticeStartResponseDTO> startPractice(
            @RequestBody @Valid PracticeStartRequestDTO request) {
        return ResponseEntity.ok(practiceService.startPractice(request));
    }

    @PostMapping("/save-answer")
    public ResponseEntity<Void> saveAnswer(@RequestParam("practiceId") Long practiceId,
            @RequestBody @Valid PracticeAnswerRequestDTO answerRequest) {
        practiceService.saveAnswer(practiceId, answerRequest);
        return ResponseEntity.ok().build();
    }



    @PostMapping("/preview")
    public ResponseEntity<List<PracticeQuestionResponseDTO>> previewPractice(
            @RequestBody @Valid PracticeStartRequestDTO request) {
        return ResponseEntity.ok(practiceService.previewPractice(request));
    }

    @PostMapping("/submit")
    public ResponseEntity<PracticeResultResponseDTO> submitPractice(
            @RequestBody @Valid PracticeSubmitRequestDTO request) {
        return ResponseEntity.ok(practiceService.submitPractice(request));
    }

    @GetMapping("/count")
    public ResponseEntity<Long> countQuestions(@RequestParam("categoryId") Long categoryId) {
        return ResponseEntity.ok(practiceService.countQuestions(categoryId));
    }

    @GetMapping("/history")
    public ResponseEntity<List<PracticeHistoryResponseDTO>> getPracticeHistory(
            @RequestParam(value = "categoryId", required = false) Long categoryId) {
        if (categoryId != null) {
            return ResponseEntity.ok(practiceService.getPracticeHistory(categoryId));
        }
        return ResponseEntity.ok(practiceService.getMyPracticeHistory());
    }

    @GetMapping("/history/detail")
    public ResponseEntity<PracticeResultResponseDTO> getPracticeDetail(@RequestParam("id") Long id) {
        return ResponseEntity.ok(practiceService.getPracticeDetail(id));
    }

    @GetMapping("/start-quiz")
    public ResponseEntity<PracticeStartResponseDTO> startPracticeFromQuiz(@RequestParam("quizId") String quizId) {
        return ResponseEntity.ok(practiceService.startPracticeFromQuiz(quizId));
    }
}

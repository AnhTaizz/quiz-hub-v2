package com.example.quizhub.controller.teacher.rest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.quizassigning.request.QuizAssigningRequestDTO;
import com.example.quizhub.dto.quizassigning.response.QuizAssigningResponseDTO;
import com.example.quizhub.service.quiz.QuizAssigningService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/teacher/quiz-assigning")
@RequiredArgsConstructor
public class TeacherQuestionAssigningController {
    private final QuizAssigningService quizAssigningService;

    @PostMapping
    public ResponseEntity<QuizAssigningResponseDTO> create(@RequestBody QuizAssigningRequestDTO requestDTO){
        QuizAssigningResponseDTO responseDTO = quizAssigningService.create(requestDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(responseDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        quizAssigningService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @org.springframework.web.bind.annotation.PatchMapping("/{id}/close")
    public ResponseEntity<Void> closeAssignment(@PathVariable Long id) {
        quizAssigningService.closeAssignment(id);
        return ResponseEntity.ok().build();
    }

    @org.springframework.web.bind.annotation.PatchMapping("/{id}/toggle-hidden")
    public ResponseEntity<Void> toggleHidden(@PathVariable Long id) {
        quizAssigningService.toggleHidden(id);
        return ResponseEntity.ok().build();
    }

    @org.springframework.web.bind.annotation.PutMapping("/{id}/deadline")
    public ResponseEntity<Void> updateDeadline(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, java.time.LocalDateTime> payload) {
        java.time.LocalDateTime newDeadline = payload.get("newDueDate");
        quizAssigningService.updateDeadline(id, newDeadline);
        return ResponseEntity.ok().build();
    }
}

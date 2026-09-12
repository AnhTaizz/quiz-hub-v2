package com.example.quizhub.controller.teacher.rest;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import com.example.quizhub.dto.quiz.request.QuizGenerateRequestDTO;
import com.example.quizhub.dto.quiz.request.QuizRequestDTO;
import com.example.quizhub.dto.quiz.response.QuizResponseDTO;
import com.example.quizhub.dto.quiz.response.QuizSummaryDTO;
import com.example.quizhub.dto.quiz.request.BulkQuizCreateRequestDTO;
import com.example.quizhub.service.quiz.QuizService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/teacher/quizzes")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
public class TeacherQuizController {

    private final QuizService quizService;

    @GetMapping("/mine")
    public ResponseEntity<List<QuizSummaryDTO>> getMyQuizzes() {
        return ResponseEntity.ok(quizService.getMyQuizzes());
    }

    @PostMapping
    public ResponseEntity<QuizResponseDTO> createQuiz(@RequestBody @Valid QuizRequestDTO request){
        return ResponseEntity.status(HttpStatus.CREATED).body(quizService.createNewQuiz(request));
    }

    @PostMapping("/bulk-create")
    public ResponseEntity<QuizResponseDTO> bulkCreateQuiz(@RequestBody @Valid BulkQuizCreateRequestDTO request){
        return ResponseEntity.status(HttpStatus.CREATED).body(quizService.bulkCreateQuiz(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<QuizResponseDTO> getQuiz(@PathVariable String id){
        return ResponseEntity.ok(quizService.getQuizById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<QuizResponseDTO> updateQuiz(
            @PathVariable String id,
            @RequestBody @Valid QuizRequestDTO request){
        return ResponseEntity.ok(quizService.updateQuiz(id, request));
    }



    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteQuiz(@PathVariable String id){
        quizService.deleteQuiz(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/generate-from-category")
    public ResponseEntity<QuizResponseDTO> generateQuizFromCategory(
            @RequestBody @Valid QuizGenerateRequestDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(quizService.generateQuizFromCategory(request));
    }

    @GetMapping("/{id}/export-excel")
    public ResponseEntity<byte[]> exportQuizToExcel(@PathVariable String id) {
        byte[] fileBytes = quizService.exportQuizToExcel(id);

        // Lấy tên đề thi để đặt tên file — dùng id làm fallback
        QuizResponseDTO quiz = quizService.getQuizById(id);
        String filename = (quiz.getTitle() != null && !quiz.getTitle().isBlank())
                ? quiz.getTitle().replaceAll("[^a-zA-Z0-9àáạảãăắặẳẵâấậẩẫèéẹẻẽêếệểễìíịỉĩòóọỏõôốộổỗơớợởỡùúụủũưứựửữỳýỵỷỹđÀÁẠẢÃĂẮẶẲẴÂẤẬẨẪÈÉẸẺẼÊẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỐỘỔỖƠỚỢỞỠÙÚỤỦŨƯỨỰỬỮỲÝỴỶỸĐ\\s_-]", "").strip() + ".xlsx"
                : "de_thi_" + id + ".xlsx";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", filename);
        headers.add(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, HttpHeaders.CONTENT_DISPOSITION);

        return ResponseEntity.ok()
                .headers(headers)
                .body(fileBytes);
    }
}

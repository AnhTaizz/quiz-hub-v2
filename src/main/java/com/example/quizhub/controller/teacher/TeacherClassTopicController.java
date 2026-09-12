package com.example.quizhub.controller.teacher;

import java.security.Principal;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.dto.classroom.request.ClassTopicRequestDTO;
import com.example.quizhub.dto.classroom.response.ClassTopicResponseDTO;
import com.example.quizhub.service.classroom.ClassTopicService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/teacher/class-topics")
@RequiredArgsConstructor
public class TeacherClassTopicController {

    private final ClassTopicService classTopicService;

    @PostMapping
    public ResponseEntity<ClassTopicResponseDTO> createTopic(@Valid @RequestBody ClassTopicRequestDTO request,
                                                             Principal principal) {
        return ResponseEntity.ok(classTopicService.createTopic(request, principal.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClassTopicResponseDTO> updateTopic(@PathVariable Long id,
                                                             @Valid @RequestBody ClassTopicRequestDTO request,
                                                             Principal principal) {
        return ResponseEntity.ok(classTopicService.updateTopic(id, request, principal.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTopic(@PathVariable Long id, Principal principal) {
        classTopicService.deleteTopic(id, principal.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/classroom/{classroomId}")
    public ResponseEntity<List<ClassTopicResponseDTO>> getTopicsByClassroom(@PathVariable Long classroomId,
                                                                            Principal principal) {
        return ResponseEntity.ok(classTopicService.getTopicsByClassroom(classroomId, principal.getName()));
    }
}

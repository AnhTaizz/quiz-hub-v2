package com.example.quizhub.controller.student.rest;

import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.quizhub.service.classroom.ClassroomService;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/student/classrooms")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentClassroomController {

    private final ClassroomService classroomService;

    @PostMapping("/join")
    public ResponseEntity<String> joinClass(Principal principal, @RequestParam String code) {
        classroomService.joinClass(principal.getName(), code);
        return ResponseEntity.ok("Đã tham gia lớp học thành công!");
    }
}

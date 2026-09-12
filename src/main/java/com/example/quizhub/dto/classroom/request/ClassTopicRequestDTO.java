package com.example.quizhub.dto.classroom.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ClassTopicRequestDTO {
    @NotBlank(message = "Tên chủ đề không được để trống")
    private String name;

    @NotNull(message = "ID lớp học không được để trống")
    private Long classroomId;
}

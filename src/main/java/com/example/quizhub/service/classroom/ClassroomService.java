package com.example.quizhub.service.classroom;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.example.quizhub.dto.classroom.request.ClassroomRequestDTO;
import com.example.quizhub.dto.classroom.response.AssignmentStatisticsDTO;
import com.example.quizhub.dto.classroom.response.ClassroomResponseDTO;
import com.example.quizhub.dto.classroom.response.MemberResponseDTO;

@Service
public interface ClassroomService {
    ClassroomResponseDTO createClassroom(String teacherEmail, ClassroomRequestDTO request);

    List<MemberResponseDTO> getMembersInClass(Long classroomId, String teacherEmail);

    void removeStudentFromClass(Long classroomId, Long studentId, String teacherEmail);

    void joinClass(String studentEmail, String classCode);

    void approveJoinRequest(Long joiningId, String teacherEmail);

    void rejectJoinRequest(Long joiningId, String teacherEmail);

    ClassroomResponseDTO updateClassroom(Long classroomId, ClassroomRequestDTO request, String teacherEmail);

    void deleteClassroom(Long classroomId, String teacherEmail);

    Map<String, Object> importStudentsFromExcel(Long classroomId, MultipartFile file, String teacherEmail);

    AssignmentStatisticsDTO getAssignmentStatistics(Long assigningId, String teacherEmail);
}

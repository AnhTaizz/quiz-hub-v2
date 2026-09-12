package com.example.quizhub.controller.user;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import com.example.quizhub.dto.user.request.CreateUserRequest;
import com.example.quizhub.dto.user.response.UserProfileResponse;
import com.example.quizhub.dto.user.response.UserResponseDTO;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.service.UserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {
    private final UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<UserResponseDTO> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<String> changeUserStatus(@PathVariable Long id,
            @RequestParam boolean enable,
            @AuthenticationPrincipal UserDetails currentUser) {
        UserResponseDTO target = userService.getUserById(id);
        if (target.getEmail().equals(currentUser.getUsername())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Bạn không thể tự khóa tài khoản của chính mình!");
        }
        userService.changeUserStatus(id, enable);
        String message = enable ? "Đã MỞ KHÓA tài khoản thành công!" : "Đã KHÓA tài khoản thành công!";
        return ResponseEntity.ok(message);
    }

    @PutMapping("/{id}/role")
    public ResponseEntity<String> changeUserRole(@PathVariable Long id,
            @RequestParam Role role,
            @AuthenticationPrincipal UserDetails currentUser) {
        UserResponseDTO target = userService.getUserById(id);
        if (target.getEmail().equals(currentUser.getUsername())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Bạn không thể tự thay đổi quyền của chính mình!");
        }
        userService.changeUserRole(id, role);
        String message = "Đã cập nhật quyền của User ID " + id + " thành " + role.name() + " thành công!";
        return ResponseEntity.ok(message);
    }

    @GetMapping
    public ResponseEntity<Page<UserProfileResponse>> getAllUsers(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(required = false) Role role,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(userService.getAllUsers(keyword, role, page, size));
    }

    @PostMapping
    public ResponseEntity<String> createUser(@Valid @RequestBody CreateUserRequest request,
            @AuthenticationPrincipal User currentUser) {
        userService.createUser(request, currentUser.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body("Tạo tài khoản thành công!");
    }

    @GetMapping("/check-email")
    public ResponseEntity<Boolean> checkEmail(@RequestParam String email) {
        return ResponseEntity.ok(userService.existsByEmail(email));
    }
}

package com.example.quizhub.controller.user;

import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.quizhub.dto.auth.request.ChangePasswordRequest;
import com.example.quizhub.dto.user.request.UpdateProfileRequest;
import com.example.quizhub.dto.user.response.UserProfileResponse;
import com.example.quizhub.service.UserService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @Value("${app.upload.avatar-dir:./uploads/avatars/}")
    private String avatarUploadDir;

    @GetMapping("/my-profile")
    public ResponseEntity<UserProfileResponse> getMyProfile(Principal principal) {
        return ResponseEntity.ok(userService.getMyProfile(principal.getName()));
    }

    @PutMapping("/my-profile")
    public ResponseEntity<UserProfileResponse> updateMyProfile(@RequestBody @Valid UpdateProfileRequest request,
            Principal principal) {
        return ResponseEntity.ok(userService.updateMyProfile(request, principal.getName()));
    }

    /**
     * Upload ảnh đại diện trực tiếp từ file.
     * Lưu vào ./uploads/avatars/<uuid>.<ext>, trả về URL /avatars/<uuid>.<ext>
     */
    @PostMapping("/upload-avatar")
    public ResponseEntity<Map<String, String>> uploadAvatar(
            @RequestParam("file") MultipartFile file,
            Principal principal) throws IOException {

        // Validate loại file
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)"));
        }

        // Validate kích thước (5MB)
        if (file.getSize() > 5 * 1024 * 1024) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "File ảnh không được vượt quá 5MB"));
        }

        // Lấy extension từ tên file gốc
        String originalFilename = file.getOriginalFilename();
        String ext = "jpg";
        if (originalFilename != null && originalFilename.contains(".")) {
            ext = originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase();
        }

        // Tạo tên file duy nhất
        String filename = UUID.randomUUID().toString() + "." + ext;

        // Tạo thư mục nếu chưa có
        Path uploadPath = Paths.get(avatarUploadDir);
        Files.createDirectories(uploadPath);

        // Lưu file
        Path filePath = uploadPath.resolve(filename);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        // Trả về URL truy cập (served bởi Spring static resources)
        String avatarUrl = "/avatars/" + filename;
        return ResponseEntity.ok(Map.of("url", avatarUrl));
    }

    @PostMapping("/change-password")
    public ResponseEntity<String> changePassword(@RequestBody @Valid ChangePasswordRequest request,
            Principal principal) {
        userService.changePassword(request, principal.getName());
        return ResponseEntity.ok("Đổi mật khẩu thành công!");
    }
}

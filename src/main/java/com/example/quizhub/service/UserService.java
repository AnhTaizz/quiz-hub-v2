package com.example.quizhub.service;

import org.springframework.data.domain.Page;

import com.example.quizhub.dto.auth.request.ChangePasswordRequest;
import com.example.quizhub.dto.user.request.CreateUserRequest;
import com.example.quizhub.dto.user.request.UpdateProfileRequest;
import com.example.quizhub.dto.user.response.UserProfileResponse;
import com.example.quizhub.dto.user.response.UserResponseDTO;
import com.example.quizhub.entity.enums.Role;

public interface UserService {
    UserResponseDTO getUserById(Long id);

    UserProfileResponse getMyProfile(String email);

    UserProfileResponse updateMyProfile(UpdateProfileRequest request, String email);

    void changePassword(ChangePasswordRequest request, String email);

    void changeUserStatus(Long userId, boolean isEnable);

    void changeUserRole(Long userId, Role role);

        Page<UserProfileResponse> getAllUsers(String key, Role role, int page, int size);

    void createUser(CreateUserRequest request, Long creatorId);

    boolean existsByEmail(String email);
}

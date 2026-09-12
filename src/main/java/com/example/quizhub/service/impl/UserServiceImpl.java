package com.example.quizhub.service.impl;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.example.quizhub.dto.auth.request.ChangePasswordRequest;
import com.example.quizhub.dto.user.request.CreateUserRequest;
import com.example.quizhub.dto.user.request.UpdateProfileRequest;
import com.example.quizhub.dto.user.response.UserProfileResponse;
import com.example.quizhub.dto.user.response.UserResponseDTO;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.service.UserService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserResponseDTO getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        return UserResponseDTO.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole().name())
                .build();
    }

    @Override
    public UserProfileResponse getMyProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        return UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRole())
                .isEnable(user.getIsEnable())
                .build();
    }

    @Override
    public UserProfileResponse updateMyProfile(UpdateProfileRequest request, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        user.setFullName(request.getFullName());
        user.setPhone(request.getPhone());
        user.setAvatarUrl(request.getAvatarUrl());
        userRepository.save(user);

        // Programmatically refresh Spring Security session principal to keep it in sync
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            UsernamePasswordAuthenticationToken newAuth = new UsernamePasswordAuthenticationToken(
                    user,
                    auth.getCredentials(),
                    auth.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(newAuth);
        }

        return UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRole())
                .isEnable(user.getIsEnable())
                .build();
    }

    @Override
    public void changePassword(ChangePasswordRequest request, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.WRONG_PASSWORD);
        }
        if (!request.getNewPassword().equals(request.getConfirmNewPassword())) {
            throw new AppException(ErrorCode.PASSWORD_MISMATCH);
        }
        if (request.getNewPassword().equals(request.getOldPassword())) {
            throw new AppException(ErrorCode.PASSWORD_SAME);
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Override
    public void changeUserStatus(Long userId, boolean isEnable) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        user.setIsEnable(isEnable);
        userRepository.save(user);
    }

    @Override
    public void changeUserRole(Long userId, Role role) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        user.setRole(role);
        userRepository.save(user);
    }

    @Override
    public Page<UserProfileResponse> getAllUsers(String keyword, Role role, int page, int size) {

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        if (keyword == null) {
            keyword = "";
        }

        Page<User> userPage = userRepository.searchUsers(keyword, role, pageable);

        return userPage.map(user -> UserProfileResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRole())
                .isEnable(user.getIsEnable())
                .build());
    }

    @Override
    public void createUser(CreateUserRequest request, Long creatorId) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.USER_EXISTED);
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole() != null ? request.getRole() : Role.STUDENT)
                .isEnable(true)
                .isVerified(true)
                .createdId(creatorId)
                .build();

        userRepository.save(user);
    }

    @Override
    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }
}

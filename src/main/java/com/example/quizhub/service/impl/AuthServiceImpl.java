package com.example.quizhub.service.impl;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.quizhub.dto.auth.request.AuthRequest;
import com.example.quizhub.dto.auth.request.OAuth2RegisterRequest;
import com.example.quizhub.dto.auth.request.RegisterRequest;
import com.example.quizhub.dto.auth.request.ResetPasswordRequest;
import com.example.quizhub.dto.auth.response.AuthResponse;
import com.example.quizhub.dto.auth.response.OAuth2PendingRegistrationResponse;
import com.example.quizhub.entity.OAuth2RegistrationTicket;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.Role;
import com.example.quizhub.exception.AppException;
import com.example.quizhub.exception.ErrorCode;
import com.example.quizhub.repository.OAuth2RegistrationTicketRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.security.JwtService;
import com.example.quizhub.service.AuthService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepository;
    private final OAuth2RegistrationTicketRepository oauth2RegistrationTicketRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JavaMailSender mailSender;
    private final Map<String, String> otpStorage = new ConcurrentHashMap<>();

    @Override
    public AuthResponse register(RegisterRequest request) {
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new AppException(ErrorCode.PASSWORD_MISMATCH);
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new AppException(ErrorCode.USER_EXISTED);
        }

        Role assignedRole = Role.STUDENT;
        if ("TEACHER".equalsIgnoreCase(request.getRole())) {
            assignedRole = Role.TEACHER;
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .role(assignedRole)
                .isEnable(true)
                .isVerified(false)
                .build();
        userRepository.save(user);
        String token = jwtService.generateToken(user);
        return AuthResponse.builder()
                .token(token)
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .avatarUrl(user.getAvatarUrl())
                .build();
    }

    /**
     * Consuming the ticket and inserting the User happen in this one @Transactional method, so they commit
     * or roll back together: if the insert fails for any reason (e.g. a same-email race from two separate
     * tickets), the ticket-consume UPDATE below is rolled back with it - the ticket goes back to unconsumed,
     * not burned with nothing to show for it, and no JWT is ever generated for a User that did not commit.
     * The ticket is consumed FIRST (atomically - see OAuth2RegistrationTicketRepository#consumeIfValid) so
     * that of two concurrent completions of the SAME ticket, only one can ever reach the User insert below.
     */
    @Override
    @Transactional
    public AuthResponse registerOAuth2(String ticketToken, OAuth2RegisterRequest request) {
        Role assignedRole = parseSelfRegistrationRole(request.getRole());

        if (ticketToken == null) {
            throw new AppException(ErrorCode.OAUTH2_REGISTRATION_INVALID);
        }
        LocalDateTime now = LocalDateTime.now();
        int consumed = oauth2RegistrationTicketRepository.consumeIfValid(ticketToken, now);
        if (consumed == 0) {
            throw new AppException(ErrorCode.OAUTH2_REGISTRATION_INVALID);
        }
        OAuth2RegistrationTicket ticket = oauth2RegistrationTicketRepository.findById(ticketToken)
                .orElseThrow(() -> new AppException(ErrorCode.OAUTH2_REGISTRATION_INVALID));

        if (userRepository.existsByEmail(ticket.getEmail())) {
            throw new AppException(ErrorCode.USER_EXISTED);
        }

        User user = User.builder()
                .email(ticket.getEmail())
                .password(passwordEncoder.encode("OAUTH2_USER_DUMMY_PASSWORD_" + System.currentTimeMillis()))
                .fullName(ticket.getFullName())
                .avatarUrl(ticket.getAvatarUrl())
                .role(assignedRole)
                .isEnable(true)
                .isVerified(true)
                .build();

        userRepository.save(user);
        String token = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(token)
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .avatarUrl(user.getAvatarUrl())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public OAuth2PendingRegistrationResponse getPendingOAuth2Registration(String ticketToken) {
        if (ticketToken == null) {
            throw new AppException(ErrorCode.OAUTH2_REGISTRATION_INVALID);
        }
        LocalDateTime now = LocalDateTime.now();
        OAuth2RegistrationTicket ticket = oauth2RegistrationTicketRepository.findById(ticketToken)
                .filter(t -> t.getConsumedAt() == null && t.getExpiresAt().isAfter(now))
                .orElseThrow(() -> new AppException(ErrorCode.OAUTH2_REGISTRATION_INVALID));

        return OAuth2PendingRegistrationResponse.builder()
                .email(ticket.getEmail())
                .fullName(ticket.getFullName())
                .avatarUrl(ticket.getAvatarUrl())
                .build();
    }

    /** STUDENT/TEACHER self-selection is existing product policy (mirrors register()); anything else is rejected. */
    private Role parseSelfRegistrationRole(String requestedRole) {
        if ("STUDENT".equalsIgnoreCase(requestedRole)) {
            return Role.STUDENT;
        }
        if ("TEACHER".equalsIgnoreCase(requestedRole)) {
            return Role.TEACHER;
        }
        throw new AppException(ErrorCode.INVALID_ROLE);
    }

    @Override
    public AuthResponse login(AuthRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
        } catch (BadCredentialsException e) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        String token = jwtService.generateToken(user);
        return AuthResponse.builder()
                .token(token)
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .avatarUrl(user.getAvatarUrl())
                .build();
    }

    @Override
    public void forgotPassword(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        String otp = String.format("%06d", new Random().nextInt(999999));
        otpStorage.put(email, otp);
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setText("Chào " + user.getFullName() + ",\n\n" +
                "Mã OTP để đặt lại mật khẩu của bạn là: " + otp + "\n\n" +
                "Vui lòng không chia sẻ mã này cho bất kỳ ai.");
        message.setSubject("[QuizHub] Mã OTP Khôi phục mật khẩu");
        mailSender.send(message);
    }

    @Override
    public void resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        String savedOtp = otpStorage.get(request.getEmail());
        if (savedOtp == null || !savedOtp.equals(request.getOtp())) {
            throw new AppException(ErrorCode.INVALID_OTP);
        }
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new AppException(ErrorCode.PASSWORD_MISMATCH);
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        otpStorage.remove(request.getEmail());
    }

    @Override
    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

}

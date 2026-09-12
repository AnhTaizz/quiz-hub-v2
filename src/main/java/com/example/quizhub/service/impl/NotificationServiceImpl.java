package com.example.quizhub.service.impl;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.example.quizhub.entity.Notification;
import com.example.quizhub.entity.User;
import com.example.quizhub.entity.enums.NotificationType;
import com.example.quizhub.repository.NotificationRepository;
import com.example.quizhub.repository.UserRepository;
import com.example.quizhub.service.NotificationService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createNotification(Long userId, String title, String message, NotificationType type, String link) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;

        Notification notification = Notification.builder()
                .user(user)
                .title(title)
                .message(message)
                .type(type)
                .link(link)
                .isRead(false)
                .build();
        notificationRepository.save(notification);
    }

    @Override
    public List<Notification> getMyNotifications(String email) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
    }

    @Override
    public long countUnread(String email) {
        User u = userRepository.findByEmail(email).orElse(null);
        if (u == null) return 0;
        return notificationRepository.countByUserIdAndIsReadFalse(u.getId());
    }

    @Override
    @Transactional
    public void markAsRead(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    @Override
    @Transactional
    public void markAllAsRead(String email) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) return;
        List<Notification> unread = notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().filter(n -> !n.isRead()).toList();
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }
}

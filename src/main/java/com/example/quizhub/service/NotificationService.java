package com.example.quizhub.service;

import com.example.quizhub.entity.Notification;
import com.example.quizhub.entity.enums.NotificationType;
import java.util.List;

public interface NotificationService {
    void createNotification(Long userId, String title, String message, NotificationType type, String link);
    List<Notification> getMyNotifications(String email);
    long countUnread(String email);
    void markAsRead(Long notificationId);
    void markAllAsRead(String email);
}

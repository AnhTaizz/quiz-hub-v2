package com.example.quizhub.service;

import com.example.quizhub.entity.Notification;
import com.example.quizhub.entity.enums.NotificationType;
import java.util.List;

public interface NotificationService {
    void createNotification(Long userId, String title, String message, NotificationType type, String link);
    List<Notification> getMyNotifications(String email);
    long countUnread(String email);
    /** Marks the caller's own notification read; a missing or foreign id both raise NOTIFICATION_NOT_FOUND. */
    void markAsRead(Long notificationId, String email);
    void markAllAsRead(String email);
}

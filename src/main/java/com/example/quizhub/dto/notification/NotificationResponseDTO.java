package com.example.quizhub.dto.notification;

import java.time.LocalDateTime;

import com.example.quizhub.entity.Notification;
import com.example.quizhub.entity.enums.NotificationType;

/**
 * JSON view of a notification for the UI (no User/JPA graph). The read flag keeps the wire name "read"
 * that the entity always serialized as (Lombok isRead() -> "read"), because the legacy header bell
 * (notifications.js) still consumes this API.
 */
public record NotificationResponseDTO(
        Long id,
        String title,
        String message,
        NotificationType type,
        boolean read,
        String link,
        LocalDateTime createdAt) {

    public static NotificationResponseDTO fromEntity(Notification n) {
        return new NotificationResponseDTO(n.getId(), n.getTitle(), n.getMessage(), n.getType(),
                n.isRead(), n.getLink(), n.getCreatedAt());
    }
}

import { httpClient } from "./httpClient";
import type { NotificationItem } from "@/types/api";

export const notificationApi = {
  list: (signal?: AbortSignal) => httpClient.get<NotificationItem[]>("/notifications", { signal }),

  unreadCount: (signal?: AbortSignal) => httpClient.get<number>("/notifications/unread-count", { signal }),

  markRead: (id: number) => httpClient.put<void>(`/notifications/${id}/read`),

  markAllRead: () => httpClient.put<void>("/notifications/read-all"),
};

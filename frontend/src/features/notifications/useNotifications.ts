import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "@/api/notification.api";

const UNREAD_KEY = ["notifications", "unread"] as const;
const LIST_KEY = ["notifications", "list"] as const;

// One cheap count request per minute (same cadence as the legacy bell) and only while the tab is visible;
// the full list is fetched only when the panel is opened.
const UNREAD_POLL_MS = 60_000;

export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: ({ signal }) => notificationApi.unreadCount(signal),
    refetchInterval: UNREAD_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}

export function useNotificationList(enabled: boolean) {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: ({ signal }) => notificationApi.list(signal),
    enabled,
    staleTime: 0,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notificationApi.markRead(id),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: UNREAD_KEY });
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

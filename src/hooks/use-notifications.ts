import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadNotificationFeed } from "@/lib/notifications/api";
import type { AppNotification } from "@/lib/notifications/types";
import { useAppStore } from "@/store/app-store";

export const notificationsQueryKey = ["notifications-feed"] as const;

export function useNotifications() {
  const readIds = useAppStore((state) => state.notificationReadIds);
  const markNotificationRead = useAppStore((state) => state.markNotificationRead);
  const markAllNotificationsRead = useAppStore((state) => state.markAllNotificationsRead);

  const { data: feed = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: loadNotificationFeed,
    staleTime: 30_000,
  });

  const notifications = useMemo<AppNotification[]>(
    () =>
      feed.map((item) => ({
        ...item,
        read: readIds.has(item.id),
      })),
    [feed, readIds],
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  function markRead(id: string) {
    markNotificationRead(id);
  }

  function markAllRead() {
    markAllNotificationsRead(feed.map((item) => item.id));
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    isError,
    error,
    refetch,
    markRead,
    markAllRead,
  };
}

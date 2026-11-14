import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPost } from '@/core/api/client';
import { isLiveApi } from '@/core/config/env';
import { useAuthStore } from '@/store/auth-store';

/** GET /api/notifications row. Written by the BE workflows (orders, fees, reviews...). */
export type NotificationDto = {
  notificationId: number;
  type: string;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  sentAt: string;
};

export type NotificationPage = { items: NotificationDto[]; hasMore: boolean };

/** The API returns at most this many, newest first. */
export const NOTIFICATION_LIMIT = 50;

export const notificationsApi = {
  list: (take = NOTIFICATION_LIMIT) => apiGet<NotificationPage>(`/notifications?take=${take}`),
  unreadCount: () => apiGet<{ unreadCount: number }>('/notifications/unread-count'),
  markRead: (notificationId: number) => apiPost<void>(`/notifications/${notificationId}/read`),
  markAllRead: () => apiPost<void>('/notifications/read-all'),
};

/** What the panel renders, whichever mode supplied it. */
export type NotificationItem = {
  id: number | string;
  type: string;
  title: string;
  body: string;
  /** What the notice is about, so a click can open it. Mock rows carry none. */
  entityType: string | null;
  entityId: number | null;
  read: boolean;
  sentAt: string;
};

const keys = {
  all: (userId: string | undefined) => ['notifications', userId] as const,
  list: (userId: string | undefined) => ['notifications', userId, 'list'] as const,
  unread: (userId: string | undefined) => ['notifications', userId, 'unread'] as const,
};

/**
 * The newest notifications, plus mark-read actions. `enabled` lets the bell
 * load the list only once its panel is opened; the badge has its own count.
 */
export function useNotifications({ enabled = true }: { enabled?: boolean } = {}) {
  const userId = useAuthStore((s) => s.user?.id);
  const client = useQueryClient();

  const query = useQuery({
    queryKey: keys.list(userId),
    queryFn: () => notificationsApi.list(),
    enabled: isLiveApi && enabled && Boolean(userId),
  });
  const refresh = () => client.invalidateQueries({ queryKey: keys.all(userId) });
  const markRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: refresh,
  });
  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: refresh,
  });

  return {
    items: (query.data?.items ?? []).map(
      (n): NotificationItem => ({
        id: n.notificationId,
        type: n.type,
        title: n.title,
        body: n.body,
        entityType: n.relatedEntityType,
        entityId: n.relatedEntityId,
        read: n.isRead,
        sentAt: n.sentAt,
      }),
    ),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
    markRead: (id: NotificationItem['id']) => markRead.mutate(Number(id)),
    markAllRead: () => markAllRead.mutate(),
  };
}

/** Unread total for the bell badge. Polls while the app is in the foreground, like chat. */
export function useNotificationUnreadCount(): number {
  const userId = useAuthStore((s) => s.user?.id);
  const query = useQuery({
    queryKey: keys.unread(userId),
    queryFn: async () => (await notificationsApi.unreadCount()).unreadCount,
    enabled: isLiveApi && Boolean(userId),
    refetchInterval: isLiveApi ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  return query.data ?? 0;
}

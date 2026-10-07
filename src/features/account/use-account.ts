import { authApi } from '@/core/api/auth-api';
import { useDualMutation, useDualQuery } from '@/core/api/dual';
import { notificationsApi } from '@/core/api/messaging-api';
import { ApiError } from '@/core/api/problem';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

export type SessionRow = { id: string; device: string; place: string; lastActive: string; current: boolean };

/** AUTH-08: devices signed in to this account. */
export function useSessions() {
  const userId = useAuthStore((s) => s.user?.id);
  const mock = useMockDb((s) => s.sessions)
    .filter((s) => s.userId === userId)
    .map((s): SessionRow => ({ id: s.id, device: s.device, place: s.location, lastActive: s.last_active, current: s.current }));
  return useDualQuery({
    key: ['sessions', userId],
    live: async () =>
      (await authApi.listSessions()).map(
        (s): SessionRow => ({
          id: String(s.sessionId),
          device: s.deviceInfo ?? 'Thiết bị không rõ',
          place: s.ipAddress ?? '',
          lastActive: s.lastActiveAt ?? s.createdAt,
          current: s.isCurrent,
        }),
      ),
    mock,
  });
}

/** AUTH-09 */
export function useRevokeSession() {
  return useDualMutation<string, void>({
    live: async (id) => void (await authApi.revokeSession(Number(id))),
    mock: (id) => useMockDb.getState().revokeSession(id),
    invalidate: [['sessions']],
  });
}

/** AUTH-07 */
export function useChangePassword() {
  return useDualMutation<{ current: string; next: string }, void>({
    live: async ({ current, next }) => void (await authApi.changePassword(current, next)),
    mock: ({ current, next }) => {
      const user = useAuthStore.getState().user;
      if (!user || current !== user.password) throw new ApiError('validation_error', 400, 'Mật khẩu hiện tại chưa đúng');
      useMockDb.getState().updateUserPassword(user.id, next);
      useAuthStore.setState({ user: { ...user, password: next } });
    },
  });
}

export type NotificationRow = { id: string; type: string; title: string; body: string; read: boolean; sentAt: string };

export function useNotifications() {
  const userId = useAuthStore((s) => s.user?.id);
  const mock = useMockDb((s) => s.notifications)
    .filter((n) => n.userId === userId)
    .map((n): NotificationRow => ({ id: n.id, type: n.notification_type, title: n.title, body: n.body, read: n.read, sentAt: n.created_at }))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  return useDualQuery({
    key: ['notifications', userId, 'list'],
    live: async () =>
      (await notificationsApi.list()).items.map(
        (n): NotificationRow => ({ id: String(n.notificationId), type: n.type, title: n.title, body: n.body, read: n.isRead, sentAt: n.sentAt }),
      ),
    mock,
    enabled: Boolean(userId),
  });
}

/** Unread total for the bell; polls every 30 s in live mode. */
export function useUnreadNotifications(): number {
  const userId = useAuthStore((s) => s.user?.id);
  const mock = useMockDb((s) => s.notifications.filter((n) => n.userId === userId && !n.read).length);
  const query = useDualQuery({
    key: ['notifications', userId, 'unread'],
    live: async () => (await notificationsApi.unreadCount()).unreadCount,
    mock,
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });
  return query.data ?? 0;
}

export function useMarkNotificationRead() {
  return useDualMutation<string, void>({
    live: async (id) => notificationsApi.markRead(Number(id)),
    mock: (id) => useMockDb.getState().markNotificationRead(id),
    invalidate: [['notifications']],
  });
}

export function useMarkAllNotificationsRead() {
  return useDualMutation<string[], void>({
    live: async () => notificationsApi.markAllRead(),
    mock: (ids) => ids.forEach((id) => useMockDb.getState().markNotificationRead(id)),
    invalidate: [['notifications']],
  });
}

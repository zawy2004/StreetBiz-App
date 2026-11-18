import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import type { RoleCode } from '@/core/types/role';
import { notificationTarget } from '@/features/notifications/notification-routing';
import { pushData, pushAvailable, registerForPush, showPushesInForeground, type PushData } from './push';

/** Where tapping a push opens: the same target as tapping the notification in the app's list. */
export function pushTarget(data: PushData, role: RoleCode | undefined): string {
  const target = notificationTarget(
    {
      id: data.notificationId ?? 0,
      type: data.type ?? '',
      title: '',
      body: '',
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      read: false,
      sentAt: '',
    },
    role,
  );
  return target ?? '/notifications';
}

/**
 * Registers the signed-in user's phone for push and opens the right screen when a push is
 * tapped, whether the app was running or launched by the tap. Mounted once at the root.
 */
export function usePushNotifications(userId: string | undefined, role: RoleCode | undefined) {
  useEffect(() => {
    if (userId) void registerForPush();
  }, [userId]);

  useEffect(() => {
    if (!userId || !pushAvailable()) return;
    showPushesInForeground();
    const open = (response: Notifications.NotificationResponse) =>
      router.push(pushTarget(pushData(response), role) as Href);

    // Launched by tapping a push while the app was closed.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) open(response);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [userId, role]);
}

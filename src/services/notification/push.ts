import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { devicesApi } from '@/core/api/devices-api';
import { env } from '@/core/config/env';
import { uuid } from '@/core/utils/uuid';

/**
 * Push notifications through Expo. After sign-in the app asks for permission, gets this
 * install's Expo push token and registers it with StreetBiz-BE (`POST /api/devices`); the server
 * then pushes every new in-app notification to it. Sign-out removes the install first, so a
 * shared phone never shows the previous account's notifications.
 *
 * Everything here is best effort: no permission, no Expo project id (before `eas init`), Expo Go
 * on Android (no remote push) or the web simply mean no push, never an error for the user.
 */
const INSTALL_ID_KEY = 'streetbiz-install-id';

let handlerSet = false;

/** Banners and sound while the app is open too: a new order must not wait for the list. Called once at the root. */
export function showPushesInForeground() {
  if (handlerSet || Platform.OS === 'web') return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function installId(): Promise<string> {
  const stored = await SecureStore.getItemAsync(INSTALL_ID_KEY).catch(() => null);
  if (stored) return stored;
  const created = uuid();
  await SecureStore.setItemAsync(INSTALL_ID_KEY, created).catch(() => undefined);
  return created;
}

/** The EAS project id written by `eas init`; without it Expo cannot issue a push token. */
export function expoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

export function pushAvailable(): boolean {
  return env.enablePushNotifications && Platform.OS !== 'web' && Boolean(expoProjectId());
}

/** Asks for permission (once) and registers this install's token for the signed-in user. */
export async function registerForPush(): Promise<boolean> {
  if (!pushAvailable()) return false;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Thông báo StreetBiz',
        importance: AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return false;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: expoProjectId() });
    await devicesApi.register(await installId(), Platform.OS === 'ios' ? 'IOS' : 'ANDROID', token);
    return true;
  } catch {
    return false;
  }
}

/** Removes this install from the signed-in user (call before signing out, while the token is valid). */
export async function unregisterPush(): Promise<void> {
  if (!pushAvailable()) return;
  try {
    const id = await SecureStore.getItemAsync(INSTALL_ID_KEY);
    if (id) await devicesApi.unregister(id);
  } catch {
    /* best effort: the server also drops tokens Expo reports as gone */
  }
}

/** The fields the server puts in a push's `data` (StreetBiz-BE ExpoPushSender). */
export type PushData = {
  notificationId?: number;
  type?: string;
  entityType?: string | null;
  entityId?: number | null;
};

export function pushData(response: Notifications.NotificationResponse): PushData {
  return (response.notification.request.content.data ?? {}) as PushData;
}

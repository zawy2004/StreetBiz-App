// Module factories run before this file's own constants exist, so the mocks are built inside
// them and read back with jest.requireMock.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[abc]' })),
  AndroidImportance: { HIGH: 6 },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-1' as string | undefined } } }, easConfig: undefined },
}));
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    store,
    getItemAsync: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    setItemAsync: jest.fn((k: string, v: string) => Promise.resolve(void store.set(k, v))),
  };
});
jest.mock('@/core/config/env', () => ({ env: { enablePushNotifications: true } }));
jest.mock('@/core/api/devices-api', () => ({
  devicesApi: { register: jest.fn(() => Promise.resolve()), unregister: jest.fn(() => Promise.resolve()) },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockNotifications = jest.requireMock('expo-notifications') as Record<string, jest.Mock>;
const mockConstants = (jest.requireMock('expo-constants') as { default: { expoConfig: { extra: { eas: { projectId?: string } } } } }).default;
const mockStore = (jest.requireMock('expo-secure-store') as { store: Map<string, string> }).store;
const mockEnv = (jest.requireMock('@/core/config/env') as { env: { enablePushNotifications: boolean } }).env;

import { devicesApi } from '@/core/api/devices-api';
import { registerForPush, unregisterPush } from '@/services/notification/push';
import { pushTarget } from '@/services/notification/usePushNotifications';

const api = devicesApi as unknown as Record<'register' | 'unregister', jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  mockEnv.enablePushNotifications = true;
  mockConstants.expoConfig.extra.eas.projectId = 'project-1';
});

describe('push registration', () => {
  it('asks for permission, gets the Expo token and registers this install once', async () => {
    expect(await registerForPush()).toBe(true);
    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(api.register).toHaveBeenCalledWith(expect.any(String), 'ANDROID', 'ExponentPushToken[abc]');

    // The same install id is reused, so the server updates the row instead of adding one.
    const firstId = api.register.mock.calls[0][0];
    await registerForPush();
    expect(api.register.mock.calls[1][0]).toBe(firstId);

    await unregisterPush();
    expect(api.unregister).toHaveBeenCalledWith(firstId);
  });

  it('does nothing without permission, without an Expo project id or when push is turned off', async () => {
    mockNotifications.requestPermissionsAsync!.mockResolvedValueOnce({ status: 'denied' });
    expect(await registerForPush()).toBe(false);

    mockConstants.expoConfig.extra.eas.projectId = undefined;
    expect(await registerForPush()).toBe(false);

    mockConstants.expoConfig.extra.eas.projectId = 'project-1';
    mockEnv.enablePushNotifications = false;
    expect(await registerForPush()).toBe(false);

    expect(api.register).not.toHaveBeenCalled();
  });

  it('never throws when the server or Expo fails', async () => {
    api.register.mockRejectedValueOnce(new Error('offline'));
    expect(await registerForPush()).toBe(false);
  });
});

describe('tapping a push', () => {
  it('opens the same screen as the notification in the list', () => {
    expect(pushTarget({ type: 'ORDER', entityType: 'ORDER', entityId: 42 }, 'CUSTOMER')).toBe('/customer/orders/42');
    expect(pushTarget({ type: 'SECURITY_ALERT', entityType: 'UserAccount', entityId: 5 }, 'VENDOR')).toBe('/account/sessions');
  });

  it('falls back to the notification list for a type without its own screen', () => {
    expect(pushTarget({ type: 'SOMETHING_NEW' }, 'CUSTOMER')).toBe('/notifications');
  });
});

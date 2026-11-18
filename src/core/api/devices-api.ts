import { apiDelete, apiPost } from './client';

/** Mirrors StreetBiz-BE `DevicesController`: the phones that receive push notifications. */
export const devicesApi = {
  register: (deviceIdentifier: string, platform: 'ANDROID' | 'IOS', pushToken: string) =>
    apiPost<void>('/devices', { deviceIdentifier, platform, pushToken }),
  unregister: (deviceIdentifier: string) =>
    apiDelete<void>(`/devices/${encodeURIComponent(deviceIdentifier)}`),
};

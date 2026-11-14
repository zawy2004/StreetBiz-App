import * as Location from 'expo-location';

import type { GeoPoint } from '@/core/api/commerce-api';

/** The app's version of the web's `geolocation.ts`, on `expo-location`. Same reasons, same messages. */
export type LocateFailure = 'UNAVAILABLE' | 'DENIED' | 'FAILED';

export class LocateError extends Error {
  constructor(public reason: LocateFailure) {
    super(reason);
  }
}

async function ensurePermission(): Promise<void> {
  if (!(await Location.hasServicesEnabledAsync())) throw new LocateError('UNAVAILABLE');
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new LocateError('DENIED');
}

/**
 * The buyer's current position (DISC-01), asked only when they tap "Tìm quanh tôi".
 * A fix up to a minute old is fine for listing nearby stalls.
 */
export async function detectPosition(): Promise<GeoPoint> {
  await ensurePermission();
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    const fix = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
    return { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
  } catch {
    throw new LocateError('FAILED');
  }
}

/** A position with how sure the device is of it: what the pickup-range check needs. */
export type PositionFix = GeoPoint & { accuracyMeters: number };

/**
 * Follows the buyer while they walk to the stall (ORD-01). Fresh fixes only: a cached one from
 * before they set off would judge the wrong place. Returns the unsubscribe function.
 */
export function watchPositionFix(
  onFix: (fix: PositionFix) => void,
  onError: (reason: LocateFailure) => void,
): () => void {
  let sub: Location.LocationSubscription | null = null;
  let stopped = false;
  ensurePermission()
    .then(() =>
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        ({ coords }) =>
          onFix({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracyMeters: coords.accuracy ?? 999,
          }),
      ),
    )
    .then((s) => {
      if (stopped) s.remove();
      else sub = s;
    })
    .catch((e: unknown) => onError(e instanceof LocateError ? e.reason : 'FAILED'));
  return () => {
    stopped = true;
    sub?.remove();
  };
}

export const LOCATE_MESSAGES: Record<LocateFailure, string> = {
  UNAVAILABLE: 'Điện thoại đang tắt định vị. Bật định vị rồi thử lại.',
  DENIED: 'Chưa được cấp quyền vị trí. Hãy cho phép trong Cài đặt rồi thử lại.',
  FAILED: 'Không lấy được vị trí. Thử lại sau.',
};

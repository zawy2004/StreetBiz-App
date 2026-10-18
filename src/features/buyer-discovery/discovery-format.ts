import type { StorefrontHour, StorefrontSummary } from '@/core/api/commerce-api';

/** Monday first, matching the ISO weekday numbers the API uses (1 = Monday ... 7 = Sunday). */
const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export type DaySchedule = { day: number; label: string; ranges: string[] };

/** "850 m" under a kilometre, "1,2 km" above; null when the distance is unknown. */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
}

export const formatHourRange = (hour: Pick<StorefrontHour, 'opensAt' | 'closesAt'>) =>
  `${hour.opensAt}–${hour.closesAt}`;

/**
 * What a card says about today's hours. Closed with no window today means hours are
 * published for other days only; open with no window means no hours are published at all.
 */
export function todayHoursText(storefront: Pick<StorefrontSummary, 'isOpenNow' | 'todayHours'>): string | null {
  if (storefront.todayHours.length > 0) return storefront.todayHours.map(formatHourRange).join(', ');
  return storefront.isOpenNow ? null : 'Nghỉ hôm nay';
}

/** Monday-first schedule for the week, or null when the storefront published no hours. */
export function weeklySchedule(hours: readonly StorefrontHour[]): DaySchedule[] | null {
  if (hours.length === 0) return null;
  return WEEKDAY_LABELS.map((label, index) => ({
    day: index + 1,
    label,
    ranges: hours
      .filter((hour) => hour.dayOfWeek === index + 1)
      .sort((a, b) => a.opensAt.localeCompare(b.opensAt))
      .map(formatHourRange),
  }));
}

/** Today's ISO weekday (Monday = 1) in Vietnam, which is UTC+7 with no daylight saving. */
export function vietnamWeekday(now: Date = new Date()): number {
  const day = new Date(now.getTime() + 7 * 3_600_000).getUTCDay();
  return day === 0 ? 7 : day;
}

export function ratingText(rating: number | null, count: number): string {
  return rating == null ? 'Chưa có đánh giá' : `${rating.toFixed(1)} ★ (${count})`;
}

export const directionsUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

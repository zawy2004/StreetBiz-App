import { PASSWORD_RULES } from '@/core/auth/password-policy';

/**
 * Pure display helpers for the account screens. Nothing here reads or writes
 * data; it only rephrases what the screen has already loaded.
 */

const VN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function parse(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

/** Calendar day in Asia/Ho_Chi_Minh, as `YYYY-MM-DD`. */
export function vnDayKey(at: Date): string {
  return VN_DAY.format(at);
}

/** "vừa xong", "5 phút trước", "3 ngày trước". Empty when the time is unknown. */
export function relativeTime(value: string | null | undefined, now: Date = new Date()): string {
  const at = parse(value);
  if (!at) return '';
  const seconds = Math.round((now.getTime() - at.getTime()) / 1000);
  if (seconds < 60) return 'vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} tháng trước`;
  return `${Math.floor(months / 12)} năm trước`;
}

/** True when the time is within the last 24 hours. */
export function within24h(value: string | null | undefined, now: Date = new Date()): boolean {
  const at = parse(value);
  return Boolean(at && now.getTime() - at.getTime() < 24 * 3600 * 1000);
}

/** Short Vietnamese date, "01/10/2026", in Asia/Ho_Chi_Minh. */
export function shortDate(value: string | null | undefined): string {
  const at = parse(value);
  return at
    ? at.toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
}

export type DayGroup<T> = { key: 'today' | 'yesterday' | 'earlier'; label: string; items: T[] };

const DAY_LABEL: Record<DayGroup<unknown>['key'], string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  earlier: 'Trước đó',
};

/**
 * "Hôm nay / Hôm qua / Trước đó", with the day boundary at midnight in
 * Asia/Ho_Chi_Minh. Order inside each group is the order given.
 */
export function groupByDay<T>(
  items: T[],
  dateOf: (item: T) => string | null | undefined,
  now: Date = new Date(),
): DayGroup<T>[] {
  const today = vnDayKey(now);
  const yesterday = vnDayKey(new Date(now.getTime() - 24 * 3600 * 1000));
  const groups = new Map<DayGroup<T>['key'], T[]>();
  for (const item of items) {
    const at = parse(dateOf(item));
    const day = at ? vnDayKey(at) : '';
    const key = day === today ? 'today' : day === yesterday ? 'yesterday' : 'earlier';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return (['today', 'yesterday', 'earlier'] as const)
    .filter((key) => groups.has(key))
    .map((key) => ({ key, label: DAY_LABEL[key], items: groups.get(key)! }));
}

/** "0905 000 002": a Vietnamese mobile number read in 4-3-3 groups. */
export function groupPhone(phone: string): string {
  const digits = phone.replace(/\s+/g, '');
  return /^\d{10}$/.test(digits)
    ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
    : phone;
}

export type DeviceKind = 'phone' | 'tablet' | 'laptop';

/** What to draw for a device, from the readable name ("Safari trên iPhone"). */
export function deviceKind(name: string | null | undefined): DeviceKind {
  const value = name ?? '';
  if (/iPad|tablet|máy tính bảng/i.test(value)) return 'tablet';
  if (/iPhone|Android|điện thoại|mobile/i.test(value)) return 'phone';
  return 'laptop';
}

/** How many of the BR-59 rules the value already meets. */
export function passedCount(value: string): number {
  return PASSWORD_RULES.filter((rule) => rule.test(value)).length;
}

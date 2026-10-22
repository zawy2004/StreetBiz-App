/**
 * Formatting shared with the web (StreetBiz-FE `formatVnd`, `discovery-format.ts`,
 * `my-slots-view.ts` contractProgress) so both say the same words and numbers.
 */

export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

/** "850 m" under a kilometre, "1,2 km" above; null when the distance is unknown. */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
}

type Hour = { opensAt: string; closesAt: string };

export const formatHourRange = (hour: Hour) => `${hour.opensAt}–${hour.closesAt}`;

/** What a card says about today's hours (web `todayHoursText`). */
export function todayHoursText(storefront: {
  isOpenNow: boolean;
  todayHours: Hour[];
}): string | null {
  if (storefront.todayHours.length > 0)
    return storefront.todayHours.map(formatHourRange).join(', ');
  return storefront.isOpenNow ? null : 'Nghỉ hôm nay';
}

export const EXPIRING_SOON_DAYS = 14;
const DAY_MS = 86_400_000;

function localDate(isoDate: string): number {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).getTime();
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export type ContractProgress = { percent: number; daysLeft: number; expiringSoon: boolean };

/** How much of the term has passed and how many days remain; the end date itself still counts as a day. */
export function contractProgress(
  startDate: string,
  endDate: string,
  today: Date,
): ContractProgress {
  const start = localDate(startDate);
  const end = localDate(endDate);
  const now = startOfDay(today);
  const total = end - start;
  const percent =
    total <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((now - start) / total) * 100)));
  const daysLeft = Math.max(0, Math.round((end - now) / DAY_MS));
  return { percent, daysLeft, expiringSoon: daysLeft <= EXPIRING_SOON_DAYS };
}

/** "31/12/2026" from an ISO date, read as a calendar date (no time-zone shift). */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** "18:42:05" in Asia/Ho_Chi_Minh (UTC+7, no DST), without relying on Intl time-zone support. */
export function formatVietnamTime(epochMs: number): string {
  const d = new Date(epochMs + 7 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** "18/10/2026 18:42" in Asia/Ho_Chi_Minh, without relying on Intl time-zone support. */
export function formatVietnamDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + 7 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "18/10/2026" for a date or an instant, read in Asia/Ho_Chi_Minh. */
export function formatVietnamDate(iso: string | null | undefined): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatDate(iso);
  return formatVietnamDateTime(iso).slice(0, 10);
}

/** "1,2 tr" / "350k" for tight spaces; the full figure goes in the accessibility label. */
export function formatShortMoney(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return `${amount} đ`;
}

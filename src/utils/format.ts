import dayjs from 'dayjs';

/**
 * Parses an instant. StreetBiz-BE sends some UTC timestamps without a zone
 * suffix ("2026-09-27T13:42:03.84"); those are UTC, not local time.
 */
export function parseInstant(value: string | Date): dayjs.Dayjs {
  if (typeof value === 'string' && /T\d{2}:\d{2}/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    return dayjs(`${value}Z`);
  }
  return dayjs(value);
}

export const formatDate = (iso: string | Date) => parseInstant(iso).format('DD/MM/YYYY');
export const formatDateTime = (iso: string | Date) => parseInstant(iso).format('DD/MM/YYYY HH:mm');
export const formatTime = (iso: string | Date) => parseInstant(iso).format('HH:mm');
export const formatVnd = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;

/** Short amount for tight tiles: 1,3tr · 250k · 900đ. */
export function formatVndCompact(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',')}tr`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return `${amount}đ`;
}

/** Whole days from now until the given date; negative once it has passed. */
export const daysUntil = (iso: string) => dayjs(iso).startOf('day').diff(dayjs().startOf('day'), 'day');

/** Parses DD/MM/YYYY typed by the user; returns null when it is not a real date. */
export function parseDate(text: string): dayjs.Dayjs | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = dayjs(`${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`);
  return d.isValid() && d.date() === Number(m[1]) ? d : null;
}

export const phoneDigits = (value: string) => value.replace(/\D/g, '');

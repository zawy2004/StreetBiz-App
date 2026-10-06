import dayjs from 'dayjs';

export const formatDate = (iso: string | Date) => dayjs(iso).format('DD/MM/YYYY');
export const formatDateTime = (iso: string | Date) => dayjs(iso).format('DD/MM/YYYY HH:mm');
export const formatVnd = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;

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

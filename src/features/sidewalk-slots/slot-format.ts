/** Display formatting for the slot workspace. Pure; the clock is always a parameter. */

/** Whole seconds left until `expiresAt`, never negative. */
export function secondsUntil(expiresAt: string, nowMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - nowMs) / 1000));
}

/** 754 -> "12:34". */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** The vendor-facing code shown next to the name. Derived, not stored. */
export function hkdCode(registrationId: number): string {
  return `HKD-${String(registrationId).padStart(4, '0')}`;
}

/** "05:00:00" -> "05:00". */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatHours(from: string | null, to: string | null): string {
  return from && to ? `${formatTime(from)} – ${formatTime(to)}` : 'Cả ngày';
}

/** "1.8 × 2.5 m", or null when either side is unknown (never guessed). */
export function formatSize(width: number | null, length: number | null): string | null {
  if (width == null || length == null) return null;
  return `${fmt(width)} × ${fmt(length)} m`;
}

export function formatAreaSqm(width: number | null, length: number | null): string | null {
  if (width == null || length == null) return null;
  return `${fmt(width * length)} m²`;
}

function fmt(value: number): string {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

/**
 * "Còn 6 ngày" / "Hết hạn hôm nay" / "Đã hết hạn" for a yyyy-mm-dd deadline.
 * The deadline day itself still counts as open.
 */
export function deadlineText(deadline: string, nowMs: number): string {
  const end = Date.parse(`${deadline}T23:59:59`);
  if (Number.isNaN(end)) return '';
  if (end < nowMs) return 'Đã hết hạn nộp';
  const days = Math.ceil((end - nowMs) / 86_400_000) - 1;
  return days <= 0 ? 'Hạn nộp: hôm nay' : `Hạn nộp: còn ${days} ngày`;
}

/** 30000 -> "30k". Whole thousands only; the exact figure is on the detail panel. */
export function formatShortVnd(amount: number): string {
  if (amount >= 1000) return `${Math.round(amount / 1000).toLocaleString('vi-VN')}k`;
  return String(amount);
}

type Priced = {
  rentalMode: 'STANDARD' | 'EVENT';
  pricePerDay: number;
  /** Absent from an older server: falls back to pricePerDay x 30. */
  monthlyPrice?: number;
};

/** A fixed location (STANDARD) is rented and priced by the month; an EVENT zone by the day. */
export function rentPrice(p: Priced): { amount: number; unit: 'tháng' | 'ngày' } {
  return p.rentalMode === 'STANDARD'
    ? { amount: p.monthlyPrice ?? p.pricePerDay * 30, unit: 'tháng' }
    : { amount: p.pricePerDay, unit: 'ngày' };
}

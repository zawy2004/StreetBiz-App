import type { FeeItemDto, InvoiceDto, PaymentTransactionDto, VendorViolationDto } from '@/core/api';

/**
 * Pure view helpers for the vendor finance screens (V25–V31). They only regroup,
 * count and sum data a screen has already loaded; nothing here calls the API.
 * Calendar days are counted in Asia/Ho_Chi_Minh.
 */

export const PURPOSE_LABEL: Record<string, string> = {
  RENTAL_FEE: 'Phí thuê ô',
  PENALTY: 'Biên bản phạt',
};

export const PROVIDER_LABEL: Record<string, string> = {
  MOMO: 'MoMo',
  ZALOPAY: 'ZaloPay',
};

export const SOURCE_LABEL: Record<string, string> = {
  ON_SITE: 'Lập tại chỗ',
  CUSTOMER_REPORT: 'Từ phản ánh của người dân',
};

const HCM_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_MS = 86_400_000;

/**
 * The calendar day ("2026-10-20") of a date in Ho Chi Minh City. A bare date or a
 * timestamp without a zone is already a local day: take its first ten characters
 * rather than letting `Date` shift it through UTC.
 */
export function hcmDay(value: string | Date): string {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}(T[^Z+]*)?$/.test(value) && !/-\d{2}:\d{2}$/.test(value.slice(10))) {
      return value.slice(0, 10);
    }
    return HCM_DAY.format(new Date(value));
  }
  return HCM_DAY.format(value);
}

/** Whole days since 1970-01-01 for a "YYYY-MM-DD" day. */
function dayNumber(day: string): number {
  const [y = 1970, m = 1, d = 1] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function dayString(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string | Date, to: string | Date): number {
  return dayNumber(hcmDay(to)) - dayNumber(hcmDay(from));
}

/** Days from today to `date`: positive ahead, negative past, 0 today. */
export function daysFromToday(date: string, now: Date = new Date()): number {
  return daysBetween(now, date);
}

export type Urgency = { text: string; tone: 'danger' | 'pending' | 'neutral' };

/** "Quá hạn 6 ngày" / "Đến hạn hôm nay" / "Còn 12 ngày" for a fee still to pay; null once paid. */
export function feeUrgency(fee: Pick<FeeItemDto, 'dueDate' | 'itemStatus'>, now = new Date()) {
  if (fee.itemStatus !== 'PENDING' && fee.itemStatus !== 'OVERDUE') return null;
  const days = daysFromToday(fee.dueDate, now);
  if (days < 0) return { text: `Quá hạn ${-days} ngày`, tone: 'danger' } satisfies Urgency;
  if (days === 0) return { text: 'Đến hạn hôm nay', tone: 'pending' } satisfies Urgency;
  return { text: `Còn ${days} ngày`, tone: days <= 7 ? 'pending' : 'neutral' } satisfies Urgency;
}

/** Fees still to pay (overdue first, then the nearest due date) and the rest (latest first). */
export function groupFees(fees: FeeItemDto[]) {
  const payable = (f: FeeItemDto) => f.itemStatus === 'PENDING' || f.itemStatus === 'OVERDUE';
  const due = fees
    .filter(payable)
    .sort(
      (a, b) =>
        Number(b.itemStatus === 'OVERDUE') - Number(a.itemStatus === 'OVERDUE') ||
        hcmDay(a.dueDate).localeCompare(hcmDay(b.dueDate)),
    );
  const settled = fees
    .filter((f) => !payable(f))
    .sort((a, b) => hcmDay(b.dueDate).localeCompare(hcmDay(a.dueDate)));
  return { due, settled };
}

/** "2026-09" for a date. */
export function monthKey(value: string | Date): string {
  return hcmDay(value).slice(0, 7);
}

export function addMonths(key: string, n: number): string {
  const [y = 1970, m = 1] = key.split('-').map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Month keys from `start` to `end`, both included. */
export function monthRange(start: string, end: string): string[] {
  const keys: string[] = [];
  for (let k = start; k <= end && keys.length < 120; k = addMonths(k, 1)) keys.push(k);
  return keys;
}

/** "Tháng 9/2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `Tháng ${m}/${y}`;
}

/** "T9", or "T9/2026" when the year should be said. */
export function shortMonthLabel(key: string, withYear = false): string {
  const [y, m] = key.split('-').map(Number);
  return withYear ? `T${m}/${y}` : `T${m}`;
}

export type MonthGroup<T> = { key: string; label: string; year: number; items: T[] };

/** Groups by calendar month, latest month first; items keep their order inside a month. */
export function groupByMonth<T>(items: T[], dateOf: (item: T) => string): MonthGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = monthKey(dateOf(item));
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => ({
      key,
      label: monthLabel(key),
      year: Number(key.slice(0, 4)),
      items: list,
    }));
}

/** One line saying what an invoice was for: "Phí thuê ô · Kỳ 1/3 · Tháng 09/2026" or "Tiền phạt". */
export function invoiceKindLine(invoice: Pick<InvoiceDto, 'kind' | 'periodLabel'>): string {
  if (invoice.kind === 'PENALTY') return 'Tiền phạt';
  return invoice.periodLabel ? `Phí thuê ô · ${invoice.periodLabel}` : 'Phí thuê ô';
}

export function ledgerTotals(invoices: InvoiceDto[]) {
  let fee = 0;
  let penalty = 0;
  for (const inv of invoices) {
    if (inv.kind === 'PENALTY') penalty += inv.amount;
    else fee += inv.amount;
  }
  return { count: invoices.length, total: fee + penalty, fee, penalty };
}

export function paymentStats(payments: PaymentTransactionDto[]) {
  const stats = { successTotal: 0, success: 0, failed: 0, pending: 0, other: 0 };
  for (const p of payments) {
    if (p.transactionStatus === 'SUCCESS') {
      stats.success += 1;
      stats.successTotal += p.amount;
    } else if (p.transactionStatus === 'FAILED') stats.failed += 1;
    else if (p.transactionStatus === 'PENDING') stats.pending += 1;
    else stats.other += 1;
  }
  return stats;
}

/** Successful payments summed per month for the `count` months ending this month, oldest first. */
export function monthTotals(payments: PaymentTransactionDto[], now = new Date(), count = 6) {
  const end = monthKey(now);
  const keys = monthRange(addMonths(end, -(count - 1)), end);
  const totals = new Map(keys.map((k) => [k, 0]));
  for (const p of payments) {
    if (p.transactionStatus !== 'SUCCESS') continue;
    const key = monthKey(p.createdAt);
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + p.amount);
  }
  return keys.map((key) => ({ key, total: totals.get(key) ?? 0, current: key === end }));
}

/** Days from the latest violation to today (0 = one was recorded today); null when there is none. */
export function daysSinceLatest(
  violations: Pick<VendorViolationDto, 'recordedAt'>[],
  now = new Date(),
) {
  if (violations.length === 0) return null;
  const latest = violations.reduce(
    (max, v) => (hcmDay(v.recordedAt) > max ? hcmDay(v.recordedAt) : max),
    '',
  );
  return Math.max(0, daysBetween(latest, now));
}

export type WeekBucket = { start: string; end: string; count: number };

/** The last `count` Monday-to-Sunday weeks (oldest first, this week last) and the violations in each. */
export function weekBuckets(
  violations: Pick<VendorViolationDto, 'recordedAt'>[],
  now = new Date(),
  count = 12,
): WeekBucket[] {
  const today = dayNumber(hcmDay(now));
  const weekday = (new Date(today * DAY_MS).getUTCDay() + 6) % 7;
  const thisWeek = today - weekday;
  const days = violations.map((v) => dayNumber(hcmDay(v.recordedAt)));
  return Array.from({ length: count }, (_, i) => {
    const start = thisWeek - (count - 1 - i) * 7;
    const end = start + 6;
    return {
      start: dayString(start),
      end: dayString(end),
      count: days.filter((d) => d >= start && d <= end).length,
    };
  });
}

/** Penalty money on the violation list by where it stands. */
export function penaltyTotals(
  violations: Pick<VendorViolationDto, 'penaltyAmount' | 'penaltyStatus'>[],
) {
  const totals = {
    unpaid: { amount: 0, count: 0 },
    paid: { amount: 0, count: 0 },
    closed: { amount: 0, count: 0 },
  };
  for (const v of violations) {
    if (v.penaltyAmount === null || !v.penaltyStatus) continue;
    const bucket =
      v.penaltyStatus === 'UNPAID'
        ? totals.unpaid
        : v.penaltyStatus === 'PAID'
          ? totals.paid
          : v.penaltyStatus === 'WAIVED' || v.penaltyStatus === 'CANCELLED'
            ? totals.closed
            : null;
    if (!bucket) continue;
    bucket.amount += v.penaltyAmount;
    bucket.count += 1;
  }
  return totals;
}

/** "23–29/9" or "29/9–5/10" for a week. */
export function weekRangeLabel(week: Pick<WeekBucket, 'start' | 'end'>): string {
  const [, sm, sd] = week.start.split('-').map(Number);
  const [, em, ed] = week.end.split('-').map(Number);
  return sm === em ? `${sd}–${ed}/${em}` : `${sd}/${sm}–${ed}/${em}`;
}

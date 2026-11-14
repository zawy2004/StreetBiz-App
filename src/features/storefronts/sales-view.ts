import type { SalesBucket, SalesSummary } from '@/features/orders/types/order.types';

/** "yyyy-mm-dd" of a date on the device clock (moved verbatim from the sales screen). */
export function dateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The UTC instant a Vietnamese day starts (or ends) (moved verbatim from the sales screen). */
export function toUtc(value: string, endOfDay = false): string {
  return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00`).toISOString();
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}

/**
 * Every day from `fromDate` to `toDate`, days without sales at zero, when the
 * buckets are days. Weeks and months are drawn as the server sent them: their
 * key format is not guessed.
 */
export function fillDailyBuckets(
  buckets: SalesBucket[],
  fromDate: string,
  toDate: string,
): SalesBucket[] {
  if (!buckets.every((bucket) => DAY_KEY.test(bucket.key))) return buckets;
  if (!DAY_KEY.test(fromDate) || !DAY_KEY.test(toDate) || fromDate > toDate) return buckets;
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  const filled: SalesBucket[] = [];
  // About a year of days at most, so an odd range cannot build a huge chart.
  for (let day = fromDate, guard = 0; day <= toDate && guard < 400; guard += 1) {
    filled.push(
      byKey.get(day) ?? {
        key: day,
        completedOrderCount: 0,
        grossSales: 0,
        refundedAmount: 0,
        netSales: 0,
      },
    );
    day = nextDay(day);
  }
  return filled;
}

/** The bucket with the highest takings (the first wins a tie); undefined when nothing sold. */
export function bestBucket(buckets: SalesBucket[]): SalesBucket | undefined {
  let best: SalesBucket | undefined;
  for (const bucket of buckets)
    if (bucket.netSales > 0 && (!best || bucket.netSales > best.netSales)) best = bucket;
  return best;
}

/** Refunds as a share of gross sales, in percent; null when there were no sales. */
export function refundRate(
  summary: Pick<SalesSummary, 'grossSales' | 'refundedAmount'>,
): number | null {
  return summary.grossSales > 0 ? (summary.refundedAmount / summary.grossSales) * 100 : null;
}

/** Buckets that had at least one completed order. */
export function activeDays(buckets: SalesBucket[]): number {
  return buckets.filter((bucket) => bucket.completedOrderCount > 0).length;
}

/** Days in a range, both ends included. */
export function daysInRange(fromDate: string, toDate: string): number {
  const [y1, m1, d1] = fromDate.split('-').map(Number);
  const [y2, m2, d2] = toDate.split('-').map(Number);
  return Math.round((Date.UTC(y2!, m2! - 1, d2!) - Date.UTC(y1!, m1! - 1, d1!)) / 86_400_000) + 1;
}

export type RangePreset = 'week' | 'month30' | 'thisMonth' | 'lastMonth';

/** The four quick ranges, on the device clock like the screen's default range. */
export function presetRange(kind: RangePreset, now: Date): { fromDate: string; toDate: string } {
  const today = dateInput(now);
  if (kind === 'week' || kind === 'month30') {
    const from = new Date(now);
    from.setDate(from.getDate() - (kind === 'week' ? 7 : 30));
    return { fromDate: dateInput(from), toDate: today };
  }
  if (kind === 'thisMonth')
    return { fromDate: dateInput(new Date(now.getFullYear(), now.getMonth(), 1)), toDate: today };
  return {
    fromDate: dateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    toDate: dateInput(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
}

/** "30/09" for a day key; the key as sent otherwise. */
export function shortKey(key: string): string {
  return DAY_KEY.test(key) ? `${key.slice(8, 10)}/${key.slice(5, 7)}` : key;
}

/** "30/09/2026" for a day key; week and month keys as the server sends them. */
export function bucketLabel(key: string): string {
  return DAY_KEY.test(key) ? `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}` : key;
}

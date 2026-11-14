import type { StatusTone } from '@/theme';
import type {
  ScheduleItemDto,
  VendorContractFinanceDto,
} from '@/core/api';

/**
 * How urgent an instalment is, in words a vendor acts on: "Quá hạn 5 ngày" rather than a status
 * code and a date to compare in their head. Overdue is the only red; "soon" is the turmeric
 * attention tone; anything further off stays quiet.
 */
export function dueBadge(item: Pick<ScheduleItemDto, 'itemStatus' | 'daysOverdue' | 'daysUntilDue' | 'dueDate'>): {
  label: string;
  tone: StatusTone;
} {
  if (item.itemStatus === 'PAID') return { label: 'Đã thanh toán', tone: 'ok' };
  if (item.itemStatus === 'CANCELLED') return { label: 'Đã huỷ', tone: 'neutral' };
  if (item.daysOverdue != null) {
    return { label: item.daysOverdue === 0 ? 'Quá hạn' : `Quá hạn ${item.daysOverdue} ngày`, tone: 'danger' };
  }
  if (item.daysUntilDue === 0) return { label: 'Đến hạn hôm nay', tone: 'pending' };
  if (item.daysUntilDue != null && item.daysUntilDue <= 7) {
    return { label: `Còn ${item.daysUntilDue} ngày`, tone: 'pending' };
  }
  return { label: `Hạn ${formatDay(item.dueDate)}`, tone: 'neutral' };
}

/** Still to be paid. A cancelled instalment (the contract ended before its period) is neither owed nor paid. */
export const isOwed = (status: string) => status === 'PENDING' || status === 'OVERDUE';

/** "25/10/2026" from an ISO date, without a time-zone shift (a due date is a calendar day). */
export function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** Whole days from `from` to `to` (ISO dates), counted on the calendar, not in hours. */
export function dayDiff(from: string, to: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** The day-count fields a flat fee list lacks, computed against `today` (ISO), for the badges. */
export function withDueDays<T extends { itemStatus: string; dueDate: string }>(
  item: T,
  today: string,
): T & { daysOverdue: number | null; daysUntilDue: number | null } {
  const outstanding = isOwed(item.itemStatus);
  const diff = dayDiff(today, item.dueDate);
  return {
    ...item,
    daysOverdue: outstanding && diff < 0 ? -diff : null,
    daysUntilDue: outstanding && diff >= 0 ? diff : null,
  };
}

/** Today as an ISO calendar day in the viewer's time zone. */
export function localToday(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Paid share of a contract's schedule, 0..1, by amount. */
export function paidShare(contract: Pick<VendorContractFinanceDto, 'paidAmount' | 'totalAmount'>): number {
  return contract.totalAmount > 0 ? Math.min(1, contract.paidAmount / contract.totalAmount) : 0;
}

/** Unpaid first (most overdue, then soonest due), then paid, newest payment first. */
export function byUrgency(a: ScheduleItemDto, b: ScheduleItemDto): number {
  const paidA = a.itemStatus === 'PAID';
  const paidB = b.itemStatus === 'PAID';
  const closedA = a.itemStatus === 'CANCELLED';
  const closedB = b.itemStatus === 'CANCELLED';
  if (closedA !== closedB) return closedA ? 1 : -1;
  if (paidA !== paidB) return paidA ? 1 : -1;
  if (paidA) return (b.paidAt ?? '').localeCompare(a.paidAt ?? '');
  return a.dueDate.localeCompare(b.dueDate);
}

type RawInstalment = {
  feeItemId: number;
  contractId: number;
  dueDate: string;
  amount: number;
  itemStatus: string;
  paidAt: string | null;
  periodLabel: string;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
};

/**
 * The demo build's version of the server's schedule view (FeeScheduleProgress in StreetBiz-BE):
 * the same rules, so the demo and the live screens look alike.
 */
export function buildSchedules(
  raw: RawInstalment[],
  contractInfo: (contractId: number) => Pick<
    VendorContractFinanceDto,
    'slotCode' | 'zoneName' | 'wardName' | 'address' | 'startDate' | 'endDate' | 'contractStatus'
  >,
  today: string,
): { contract: VendorContractFinanceDto; items: ScheduleItemDto[] }[] {
  const byContract = new Map<number, RawInstalment[]>();
  for (const row of raw) byContract.set(row.contractId, [...(byContract.get(row.contractId) ?? []), row]);

  return [...byContract.entries()].map(([contractId, rows]) => {
    const ordered = [...rows].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const items: ScheduleItemDto[] = ordered.map((row, index) => {
      const outstanding = isOwed(row.itemStatus);
      const diff = dayDiff(today, row.dueDate);
      const late = outstanding && diff < 0;
      return {
        feeItemId: row.feeItemId,
        ordinal: index + 1,
        ofCount: ordered.length,
        periodLabel: row.periodLabel,
        dueDate: row.dueDate,
        amount: row.amount,
        itemStatus: late ? 'OVERDUE' : row.itemStatus,
        paidAt: row.paidAt,
        invoiceId: row.invoiceId ?? null,
        invoiceNumber: row.invoiceNumber ?? null,
        daysOverdue: late ? -diff : null,
        daysUntilDue: outstanding && !late ? diff : null,
      };
    });
    // The oldest unpaid instalment is the only one payable: they are settled in order.
    const firstOwed = items.find((item) => isOwed(item.itemStatus));
    for (const item of items) item.payableNow = item === firstOwed;
    const live = items.filter((item) => item.itemStatus !== 'CANCELLED');
    const paid = live.filter((item) => item.itemStatus === 'PAID');
    const owed = live.filter((item) => isOwed(item.itemStatus));
    return {
      contract: {
        contractId,
        ...contractInfo(contractId),
        totalAmount: live.reduce((sum, item) => sum + item.amount, 0),
        paidAmount: paid.reduce((sum, item) => sum + item.amount, 0),
        outstandingAmount: owed.reduce((sum, item) => sum + item.amount, 0),
        instalmentCount: live.length,
        paidCount: paid.length,
        overdueCount: owed.filter((item) => item.daysOverdue != null).length,
        nextDue: owed[0] ?? null,
      },
      items,
    };
  });
}

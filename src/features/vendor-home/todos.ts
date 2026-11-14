import type { ApiRegistration, FeeItemDto, PenaltyListDto } from '@/core/api';

// Same payable rules as FinanceHomeScreen. Mock penalties are PENDING, live ones UNPAID.
export const PAYABLE_FEE = new Set(['PENDING', 'OVERDUE']);
export const PAYABLE_PENALTY = new Set(['UNPAID', 'PENDING']);

export type TodoKind = 'registration' | 'slots' | 'fee' | 'penalty';

export type Todo = {
  key: string;
  kind: TodoKind;
  /** The exact line the vendor reads (and tests look for). */
  title: string;
  /** Where pressing the ticket goes. */
  path: string;
  /** VND to pay; null for a registration that needs more information. */
  amount: number | null;
  /** Fee due date or penalty issue date (ISO). */
  date: string | null;
  slotCode: string | null;
  /** Ward's reason (registration) or violation label (penalty). */
  note: string | null;
  overdue: boolean;
};

/**
 * After approval, the free slots near where the registration said the vendor sells -- counted
 * when the home screen loads, never stored (a slot may have been rented meanwhile). The vendor
 * still picks a slot and applies through the normal flow (BR-16).
 */
export type SlotsNearApproval = {
  registrationId: number;
  displayName: string;
  /** Free slots within the search radius; 0 when the registration has no position. */
  count: number;
  /** The nearest free slot, to open the slot workspace on its street. */
  nearest: { zoneId: number; slotId: number; zoneName: string } | null;
};

/**
 * Today's todos, in the order the home screen has always listed them:
 * registrations needing more information, then (once approved and with no slot yet) the free
 * slots nearby, then payable fees, then payable penalties, each group in API order.
 */
export function buildTodos(
  registrations: ApiRegistration[],
  feeItems: FeeItemDto[],
  penalties: PenaltyListDto[],
  slotsNear: SlotsNearApproval | null = null,
): Todo[] {
  return [
    ...registrations
      .filter((r) => r.registrationStatus === 'MORE_INFORMATION_REQUIRED')
      .map<Todo>((r) => ({
        key: `registration-${r.registrationId}`,
        kind: 'registration',
        title: `Bổ sung hồ sơ: ${r.displayName}`,
        path: `/vendor/home/registrations/${r.registrationId}`,
        amount: null,
        date: r.reviewedAt,
        slotCode: null,
        note: r.reviewDecisionReason,
        overdue: false,
      })),
    ...(slotsNear
      ? [
          {
            key: `slots-${slotsNear.registrationId}`,
            kind: 'slots' as const,
            title: slotsNear.count > 0 ? `Hồ sơ đã duyệt — có ${slotsNear.count} ô trống gần chỗ bạn bán` : 'Hồ sơ đã duyệt — chọn ô vỉa hè để xin thuê',
            path: slotsNear.nearest ? `/vendor/slots?zone=${slotsNear.nearest.zoneId}&slot=${slotsNear.nearest.slotId}` : '/vendor/slots',
            amount: null,
            date: null,
            slotCode: null,
            note: slotsNear.nearest ? `Gần nhất: ${slotsNear.nearest.zoneName}. Chọn ô rồi xin thuê.` : 'Chọn ô rồi xin thuê.',
            overdue: false,
          },
        ]
      : []),
    ...feeItems
      .filter((f) => PAYABLE_FEE.has(f.itemStatus))
      .map<Todo>((f) => ({
        key: `fee-${f.feeItemId}`,
        kind: 'fee',
        title: `Thanh toán phí ${f.periodLabel}`,
        path: `/vendor/finance/fees/${f.feeItemId}/payment`,
        amount: f.amount,
        date: f.dueDate,
        slotCode: f.slotCode || null,
        note: null,
        overdue: f.itemStatus === 'OVERDUE',
      })),
    ...penalties
      .filter((p) => PAYABLE_PENALTY.has(p.penaltyStatus))
      .map<Todo>((p) => ({
        key: `penalty-${p.penaltyId}`,
        kind: 'penalty',
        title: `Thanh toán biên bản phạt`,
        path: `/vendor/finance/penalties/${p.penaltyId}/payment`,
        amount: p.amount,
        date: p.issuedAt,
        slotCode: p.slotCode,
        note: p.violationLabel || null,
        overdue: false,
      })),
  ];
}

/** Total VND across the payable todos, plus how many fees and penalties make it up. */
export function payableSummary(todos: Todo[]) {
  let total = 0;
  let fees = 0;
  let penalties = 0;
  let registrations = 0;
  for (const t of todos) {
    if (t.kind === 'fee') fees += 1;
    if (t.kind === 'penalty') penalties += 1;
    if (t.kind === 'registration') registrations += 1;
    total += t.amount ?? 0;
  }
  return { total, fees, penalties, registrations };
}

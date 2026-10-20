import type { ApiRegistration, FeeItemDto, PenaltyListDto } from '@/core/api';

// Same payable rules as FinanceHomeScreen. Mock penalties are PENDING, live ones UNPAID.
export const PAYABLE_FEE = new Set(['PENDING', 'OVERDUE']);
export const PAYABLE_PENALTY = new Set(['UNPAID', 'PENDING']);

export type TodoKind = 'registration' | 'fee' | 'penalty';

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
 * Today's todos, in the order the home screen has always listed them:
 * registrations needing more information, then payable fees, then payable
 * penalties, each group in API order. Titles are unchanged.
 */
export function buildTodos(
  registrations: ApiRegistration[],
  feeItems: FeeItemDto[],
  penalties: PenaltyListDto[],
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

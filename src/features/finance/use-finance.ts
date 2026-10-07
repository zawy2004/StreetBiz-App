import dayjs from 'dayjs';

import { apiAssetUrl } from '@/core/api/client';
import { idempotencyKey, useDualMutation, useDualQuery } from '@/core/api/dual';
import { financeApi } from '@/core/api/vendor-api';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

import { feeStatus, transactionCode } from './utils';

export type FeeView = { id: string; contractId: string; slotCode?: string; period: string; dueDate: string; amount: number; status: string };
export type PenaltyView = { id: string; violationId?: string; reason: string; slotCode?: string; amount: number; status: string; issuedAt: string };
export type ViolationView = { id: string; penaltyId?: string; reason: string; note?: string; slotCode?: string; amount?: number; status: string; recordedAt: string; photoUrl?: string };
export type PaymentView = { id: string; title: string; amount: number; at: string; status: string; provider?: string };
export type InvoiceView = { id: string; number: string; label: string; amount: number; issuedAt: string; slotCode?: string; provider?: string; paidAt?: string };

/** A PENDING fee past its due date shows as overdue (the backend may not have swept it yet). */
const withOverdue = (status: string, due: string) => (status === 'PENDING' && dayjs(due).isBefore(dayjs(), 'day') ? 'OVERDUE' : status);

/** Demo penalties say PENDING where the backend says UNPAID. */
const penaltyStatus = (s: string) => (s === 'PENDING' ? 'UNPAID' : s);

export const isFeeOpen = (f: FeeView) => f.status === 'PENDING' || f.status === 'OVERDUE';
export const isPenaltyOpen = (p: { status: string }) => p.status === 'UNPAID';

export function useFees() {
  const user = useAuthStore((s) => s.user);
  const db = useMockDb();
  const codeOf = (contractId: string) => db.slots.find((s) => s.id === db.contracts.find((c) => c.id === contractId)?.slotId)?.slot_code;
  const mock = db.feeItems
    .filter((f) => f.vendorId === user?.vendorId)
    .map((f): FeeView => ({ id: f.id, contractId: f.contractId, slotCode: codeOf(f.contractId), period: f.period_label, dueDate: f.due_date, amount: f.amount, status: feeStatus(f) }));
  return useDualQuery({
    key: ['vendor', user?.id, 'finance', 'fees'],
    live: async () =>
      (await financeApi.fees()).map(
        (f): FeeView => ({ id: String(f.feeItemId), contractId: String(f.contractId), slotCode: f.slotCode, period: f.periodLabel, dueDate: f.dueDate, amount: f.amount, status: withOverdue(f.itemStatus, f.dueDate) }),
      ),
    mock,
  });
}

export function usePenalties() {
  const user = useAuthStore((s) => s.user);
  const mock = useMockDb((s) => s.penalties)
    .filter((p) => p.vendorId === user?.vendorId)
    .map((p): PenaltyView => ({ id: p.id, violationId: p.violationId, reason: p.reason, amount: p.amount, status: penaltyStatus(p.penalty_status), issuedAt: p.issued_at }));
  return useDualQuery({
    key: ['vendor', user?.id, 'finance', 'penalties'],
    live: async () =>
      (await financeApi.penalties()).map(
        (p): PenaltyView => ({
          id: String(p.penaltyId),
          violationId: String(p.violationId),
          reason: p.violationLabel,
          slotCode: p.slotCode ?? undefined,
          amount: p.amount,
          status: p.penaltyStatus,
          issuedAt: p.issuedAt,
        }),
      ),
    mock,
  });
}

/** FEE-05: violations on record, each with its penalty (if one was issued). */
export function useViolations() {
  const user = useAuthStore((s) => s.user);
  const db = useMockDb();
  const mock = db.penalties
    .filter((p) => p.vendorId === user?.vendorId)
    .map((p): ViolationView => {
      const v = db.violations.find((x) => x.id === p.violationId);
      return {
        id: p.id,
        penaltyId: p.id,
        reason: p.reason,
        note: v?.note,
        slotCode: db.slots.find((s) => s.id === v?.slotId)?.slot_code,
        amount: p.amount,
        status: p.penalty_status === 'PENDING' ? 'PENDING_SANCTION' : p.penalty_status,
        recordedAt: p.issued_at,
        photoUrl: v?.photoUris[0],
      };
    });
  return useDualQuery({
    key: ['vendor', user?.id, 'finance', 'violations'],
    live: async () => {
      const [violations, penalties] = await Promise.all([financeApi.violations(), financeApi.penalties()]);
      return violations.map(
        (v): ViolationView => ({
          id: String(v.violationId),
          penaltyId: penalties.find((p) => p.violationId === v.violationId)?.penaltyId.toString(),
          reason: v.violationLabel,
          note: v.description ?? undefined,
          slotCode: v.slotCode ?? undefined,
          amount: v.penaltyAmount ?? undefined,
          status: v.penaltyStatus ?? 'RESOLVED',
          recordedAt: v.recordedAt,
          photoUrl: apiAssetUrl(v.evidenceUrl),
        }),
      );
    },
    mock,
  });
}

/** FEE-05: payment attempts (live) or what has been paid (demo), newest first. */
export function usePaymentHistory() {
  const user = useAuthStore((s) => s.user);
  const db = useMockDb();
  const mock: PaymentView[] = [
    ...db.invoices
      .filter((i) => i.vendorId === user?.vendorId)
      .map((i) => ({ id: i.id, title: `Phí thuê ô ${db.feeItems.find((f) => f.id === i.feeItemId)?.period_label ?? ''}`.trim(), amount: i.amount, at: i.issued_at, status: 'SUCCESS' })),
    ...db.penalties
      .filter((p) => p.vendorId === user?.vendorId && p.penalty_status === 'PAID')
      .map((p) => ({ id: p.id, title: p.reason, amount: p.amount, at: p.issued_at, status: 'SUCCESS' })),
  ].sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf());
  return useDualQuery({
    key: ['vendor', user?.id, 'finance', 'payments'],
    live: async () =>
      (await financeApi.payments()).map(
        (p): PaymentView => ({
          id: String(p.transactionId),
          title: `${p.purpose === 'RENTAL_FEE' ? 'Phí thuê ô' : 'Tiền phạt'} · ${p.referenceLabel}${p.slotCode ? ` · ${p.slotCode}` : ''}`,
          amount: p.amount,
          at: p.createdAt,
          status: p.transactionStatus,
          provider: p.provider,
        }),
      ),
    mock,
  });
}

/** FEE-03 */
export function useInvoices() {
  const user = useAuthStore((s) => s.user);
  const db = useMockDb();
  const mock = db.invoices
    .filter((i) => i.vendorId === user?.vendorId)
    .map((i): InvoiceView => ({ id: i.id, number: i.invoice_number, label: `Phí thuê ô ${db.feeItems.find((f) => f.id === i.feeItemId)?.period_label ?? ''}`.trim(), amount: i.amount, issuedAt: i.issued_at }));
  return useDualQuery({
    key: ['vendor', user?.id, 'finance', 'invoices'],
    live: async () =>
      (await financeApi.invoices()).map(
        (i): InvoiceView => ({ id: String(i.invoiceId), number: i.invoiceNumber, label: i.kind === 'FEE' ? `Phí thuê ô ${i.periodLabel ?? ''}`.trim() : 'Tiền phạt', amount: i.amount, issuedAt: i.issuedAt }),
      ),
    mock,
  });
}

export function useInvoice(id: string | undefined) {
  const list = useInvoices();
  return useDualQuery({
    key: ['vendor', 'invoice', id],
    live: async (): Promise<InvoiceView> => {
      const i = await financeApi.invoice(id!);
      return {
        id: String(i.invoiceId),
        number: i.invoiceNumber,
        label: i.kind === 'FEE' ? `Phí thuê ô ${i.periodLabel ?? ''}`.trim() : (i.violationLabel ?? 'Tiền phạt'),
        amount: i.amount,
        issuedAt: i.issuedAt,
        slotCode: i.slotCode ?? undefined,
        provider: i.paymentProvider ?? undefined,
        paidAt: i.paidAt ?? undefined,
      };
    },
    mock: list.data?.find((i) => i.id === id) ?? null,
    enabled: Boolean(id),
  });
}

export type CheckoutResult = { transactionId: string; paymentUrl?: string; code: string };

/**
 * FEE-01/FEE-04: start paying a fee or penalty. Live returns the provider's
 * payment page and a transaction to confirm; the demo marks it paid at once.
 */
export function useStartPayment(kind: 'fee' | 'penalty') {
  return useDualMutation<{ id: string; provider: 'MOMO' | 'ZALOPAY' }, CheckoutResult>({
    live: async ({ id, provider }) => {
      const r = kind === 'fee' ? await financeApi.payFee(id, provider, idempotencyKey()) : await financeApi.payPenalty(id, provider, idempotencyKey());
      return { transactionId: String(r.transactionId), paymentUrl: r.paymentUrl || undefined, code: `GD-${r.transactionId}` };
    },
    mock: ({ id }) => {
      if (kind === 'fee') useMockDb.getState().payFee(id);
      else useMockDb.getState().payPenalty(id);
      return { transactionId: id, code: transactionCode() };
    },
    invalidate: [['vendor']],
  });
}

/** Development sandbox: pretend the provider confirmed a fee/penalty payment. */
export function useConfirmSandboxPayment() {
  return useDualMutation<string, void>({
    live: async (transactionId) => void (await financeApi.sandboxConfirm(Number(transactionId))),
    mock: () => undefined,
    invalidate: [['vendor']],
  });
}

/** Back from the payment app: ask the backend for the real state. */
export function useSyncFinancePayment() {
  return useDualMutation<string, 'PENDING' | 'SUCCESS' | 'FAILED'>({
    live: async (transactionId) => (await financeApi.syncPayment(Number(transactionId))).status,
    mock: () => 'SUCCESS',
    invalidate: [['vendor']],
  });
}

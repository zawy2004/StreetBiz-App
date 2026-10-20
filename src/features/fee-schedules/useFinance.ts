import { useMutation, useQuery } from '@tanstack/react-query';

import { financeApi, type PaymentProvider } from '@/core/api';

/** Same keys as the web, so the vendor screens share cache and invalidation. */
export const FINANCE_KEYS = {
  summary: ['finance', 'summary'] as const,
  fees: (status?: string) => ['finance', 'fees', status ?? 'ALL'] as const,
  penalties: (status?: string) => ['finance', 'penalties', status ?? 'ALL'] as const,
  payments: ['finance', 'payments'] as const,
  violations: ['finance', 'violations'] as const,
  invoices: ['finance', 'invoices'] as const,
  invoice: (invoiceId: number) => ['finance', 'invoices', invoiceId] as const,
};

function shape<T>(query: {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
  isRefetching: boolean;
}) {
  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/** FEE-05: what the vendor owes now. */
export function useFinanceSummary() {
  const query = useQuery({ queryKey: FINANCE_KEYS.summary, queryFn: financeApi.summary });
  return { summary: query.data, ...shape(query) };
}

/** FEE-01: instalments, optionally by status. */
export function useFeeItems(status?: string) {
  const query = useQuery({
    queryKey: FINANCE_KEYS.fees(status),
    queryFn: () => financeApi.fees(status),
  });
  return { feeItems: query.data ?? [], ...shape(query) };
}

/** FEE-04: penalty notices, optionally by status. */
export function usePenalties(status?: string) {
  const query = useQuery({
    queryKey: FINANCE_KEYS.penalties(status),
    queryFn: () => financeApi.penalties(status),
  });
  return { penalties: query.data ?? [], ...shape(query) };
}

/** FEE-02: payment transactions. */
export function usePaymentHistory() {
  const query = useQuery({ queryKey: FINANCE_KEYS.payments, queryFn: financeApi.payments });
  return { payments: query.data ?? [], ...shape(query) };
}

/** The vendor's own violation history. */
export function useVendorViolations() {
  const query = useQuery({ queryKey: FINANCE_KEYS.violations, queryFn: financeApi.violations });
  return { violations: query.data ?? [], ...shape(query) };
}

/** FEE-03: the caller's invoices, most recent first. */
export function useInvoices() {
  const query = useQuery({ queryKey: FINANCE_KEYS.invoices, queryFn: financeApi.invoices });
  return { invoices: query.data ?? [], ...shape(query) };
}

/** FEE-03: one invoice's full detail. */
export function useInvoiceDetail(invoiceId: number) {
  const query = useQuery({
    queryKey: FINANCE_KEYS.invoice(invoiceId),
    queryFn: () => financeApi.invoice(invoiceId),
    enabled: Number.isFinite(invoiceId),
  });
  return { invoice: query.data, ...shape(query) };
}

/** FEE-01 checkout with the gateway (idempotency key per attempt, BR-37). */
export function usePayFeeCheckout() {
  return useMutation({
    mutationFn: ({
      feeItemId,
      provider,
      idempotencyKey,
    }: {
      feeItemId: number;
      provider: PaymentProvider;
      idempotencyKey: string;
    }) => financeApi.payFeeCheckout(feeItemId, provider, idempotencyKey),
  });
}

/** FEE-04 checkout for a penalty (same gateway flow). */
export function usePayPenaltyCheckout() {
  return useMutation({
    mutationFn: ({
      penaltyId,
      provider,
      idempotencyKey,
    }: {
      penaltyId: number;
      provider: PaymentProvider;
      idempotencyKey: string;
    }) => financeApi.payPenaltyCheckout(penaltyId, provider, idempotencyKey),
  });
}

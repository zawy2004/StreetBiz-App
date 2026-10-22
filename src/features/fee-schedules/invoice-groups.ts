import type { InvoiceDto } from '@/core/api';

export type InvoiceKindFilter = 'ALL' | 'FEE' | 'PENALTY';

/** The server says FEE or PENALTY; the demo database says RENTAL_FEE. */
export const invoiceKind = (invoice: Pick<InvoiceDto, 'kind'>): 'FEE' | 'PENALTY' =>
  invoice.kind === 'PENALTY' ? 'PENALTY' : 'FEE';

export type InvoiceMonth = {
  key: string;
  label: string;
  total: number;
  invoices: InvoiceDto[];
};

/**
 * Receipts of one year (local calendar), optionally one kind, grouped by month: newest month
 * first, newest receipt first inside it, each month with its own total.
 */
export function groupInvoices(
  invoices: InvoiceDto[],
  filter: { kind: InvoiceKindFilter; year: number | undefined },
): { months: InvoiceMonth[]; total: number; count: number } {
  const kept = invoices
    .filter((invoice) => filter.year === undefined || new Date(invoice.issuedAt).getFullYear() === filter.year)
    .filter((invoice) => filter.kind === 'ALL' || invoiceKind(invoice) === filter.kind)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));

  const months = new Map<string, InvoiceMonth>();
  for (const invoice of kept) {
    const date = new Date(invoice.issuedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const month = months.get(key) ?? {
      key,
      label: `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`,
      total: 0,
      invoices: [],
    };
    month.total += invoice.amount;
    month.invoices.push(invoice);
    months.set(key, month);
  }

  return {
    months: [...months.values()],
    total: kept.reduce((sum, invoice) => sum + invoice.amount, 0),
    count: kept.length,
  };
}

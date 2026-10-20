import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { wardReportApi } from '@/core/api';

/** Same keys as the web, live data only (the app has no demo database). */
export const WARD_REPORT_KEYS = {
  collectionReport: (from: string, to: string) => ['ward', 'reports', 'collection', from, to] as const,
  dashboard: ['ward', 'dashboard'] as const,
  summary: (from: string, to: string) => ['ward', 'reports', 'summary', from, to] as const,
};

export const WARD_COLLECTION_KEYS = {
  performance: (from: string, to: string) => ['ward', 'reports', 'performance', from, to] as const,
  trend: (months: number) => ['ward', 'reports', 'trend', months] as const,
  debtors: ['ward', 'reports', 'debtors'] as const,
  receivables: ['ward', 'reports', 'receivables'] as const,
  refunds: ['ward', 'reports', 'refunds'] as const,
};

/** Inclusive calendar-day range, "YYYY-MM-DD" in Vietnamese local time. */
export type ReportPeriod = { from: string; to: string };

/** WARD-15. */
export function useWardDashboard() {
  return useQuery({ queryKey: WARD_REPORT_KEYS.dashboard, queryFn: wardReportApi.dashboard });
}

/** WARD-14. */
export function useCollectionReport(period: ReportPeriod) {
  return useQuery({
    queryKey: WARD_REPORT_KEYS.collectionReport(period.from, period.to),
    queryFn: () => wardReportApi.collectionReport(period.from, period.to),
    placeholderData: keepPreviousData,
  });
}

/** AIC-08: sentences computed on the server from the same rows as the report. */
export function useReportSummary(period: ReportPeriod) {
  const query = useQuery({
    queryKey: WARD_REPORT_KEYS.summary(period.from, period.to),
    queryFn: () => wardReportApi.summary(period.from, period.to),
  });
  // A body without its list of points is not a summary; leave the card out rather than crash.
  return { ...query, summary: Array.isArray(query.data?.points) ? query.data : undefined };
}

export function useCollectionPerformance(period: ReportPeriod) {
  return useQuery({
    queryKey: WARD_COLLECTION_KEYS.performance(period.from, period.to),
    queryFn: () => wardReportApi.performance(period.from, period.to),
    placeholderData: keepPreviousData,
  });
}

export function useCollectionTrend(months = 6) {
  return useQuery({ queryKey: WARD_COLLECTION_KEYS.trend(months), queryFn: () => wardReportApi.trend(months) });
}

export function useWardDebtors() {
  return useQuery({ queryKey: WARD_COLLECTION_KEYS.debtors, queryFn: wardReportApi.debtors });
}

export function useReceivables() {
  return useQuery({ queryKey: WARD_COLLECTION_KEYS.receivables, queryFn: wardReportApi.receivables });
}

export function useWardRefunds() {
  return useQuery({ queryKey: WARD_COLLECTION_KEYS.refunds, queryFn: wardReportApi.refunds });
}

/** The ward paid a payment back; the list and the counts above it re-read. */
export function useMarkRefunded() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: number) => wardReportApi.markRefunded(transactionId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WARD_COLLECTION_KEYS.refunds });
      void queryClient.invalidateQueries({ queryKey: WARD_COLLECTION_KEYS.receivables });
    },
  });
}

/** One reminder per household per day; the list re-reads so "đã nhắc" shows at once. */
export function useRemindDebtor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contractId: number) => wardReportApi.remindDebtor(contractId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: WARD_COLLECTION_KEYS.debtors }),
  });
}

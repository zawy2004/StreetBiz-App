import { useQuery } from '@tanstack/react-query';

import { financeApi } from '@/core/api';

export const SCHEDULE_KEYS = {
  contracts: ['finance', 'contracts'] as const,
  schedule: (contractId: number) => ['finance', 'contracts', contractId] as const,
  feeItem: (feeItemId: number) => ['finance', 'fees', 'detail', feeItemId] as const,
};

/** FinanceHome: every contract with a fee schedule and its progress. */
export function useVendorContracts() {
  const query = useQuery({ queryKey: SCHEDULE_KEYS.contracts, queryFn: financeApi.contracts });
  return {
    contracts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** One contract's schedule, instalment by instalment. */
export function useContractSchedule(contractId: number) {
  const query = useQuery({
    queryKey: SCHEDULE_KEYS.schedule(contractId),
    queryFn: () => financeApi.contractSchedule(contractId),
    enabled: Number.isFinite(contractId),
  });
  return {
    schedule: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** FEE-01: one instalment and its contract. */
export function useFeeItemDetail(feeItemId: number) {
  return useQuery({
    queryKey: SCHEDULE_KEYS.feeItem(feeItemId),
    queryFn: () => financeApi.feeItem(feeItemId),
    enabled: Number.isFinite(feeItemId),
  });
}

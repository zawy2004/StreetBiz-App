/**
 * Permit reads for Giấy phép số, the same endpoints and keys as the web (V19):
 * GET /vendor/rental-contracts/{id}/permit → ['side', userId, 'permit', id],
 * GET /vendor/rental-contracts/{id} → ['side', userId, 'contract', id].
 * BR-39: the permit is never served from a cache: no stale time, no retained data,
 * fetched again on every mount and every pull.
 */
import { useQuery } from '@tanstack/react-query';

import { sideApi } from '@/core/api/side-api';
import { useAuthStore } from '@/store/auth-store';

export const usePermit = (contractId: number) => {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: ['side', userId, 'permit', contractId],
    queryFn: () => sideApi.getPermit(contractId),
    enabled: Number.isFinite(contractId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
};

export const useContract = (contractId: number) => {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: ['side', userId, 'contract', contractId],
    queryFn: () => sideApi.getContract(contractId),
    enabled: Number.isFinite(contractId),
  });
};

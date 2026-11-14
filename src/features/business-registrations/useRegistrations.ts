import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { vendorRegistrationApi } from '@/core/api';

/** Same key as the web, so every vendor screen shares the warm list. */
export const REGISTRATIONS_KEY = ['vendor', 'registrations'];

/** REG-03: the caller's registrations. */
export function useRegistrations() {
  const query = useQuery({
    queryKey: REGISTRATIONS_KEY,
    queryFn: () => vendorRegistrationApi.list(),
  });
  return {
    registrations: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/** REG-03 detail: one registration and the evidence attached to it. */
export function useRegistrationDetail(registrationId: number) {
  const query = useQuery({
    queryKey: [...REGISTRATIONS_KEY, registrationId],
    queryFn: () => vendorRegistrationApi.get(registrationId),
    enabled: Number.isFinite(registrationId),
  });
  return {
    registration: query.data?.registration,
    evidence: query.data?.evidence ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}

/** REG-05 */
export function useWithdrawRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (registrationId: number) => vendorRegistrationApi.withdraw(registrationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REGISTRATIONS_KEY }),
  });
}

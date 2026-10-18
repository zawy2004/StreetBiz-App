import { useQuery } from '@tanstack/react-query';

import { errorMessage, referenceApi } from '@/core/api';

/** Wards for the sign-up and registration pickers (`GET /administrative-units/wards`). */
export function useWards() {
  const query = useQuery({
    queryKey: ['wards'],
    queryFn: () => referenceApi.listWards(),
    staleTime: 30 * 60 * 1000, // reference data; refetching per screen is wasteful
  });
  return {
    wards: query.data ?? [],
    loading: query.isLoading,
    error: query.isError ? errorMessage(query.error) : undefined,
    refetch: query.refetch,
  };
}

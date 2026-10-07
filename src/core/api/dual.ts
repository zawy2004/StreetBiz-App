import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import { isLiveApi } from '@/core/config/env';

/** What every data hook hands a screen, whichever mode supplied the data. */
export type Loadable<T> = {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  isRefetching: boolean;
};

const noop = () => undefined;

type DualQuery<T> = {
  key: QueryKey;
  /** Fetches from StreetBiz-BE. */
  live: () => Promise<T>;
  /** The same shape computed from the demo store (src/mocks); already reactive. */
  mock: T;
  enabled?: boolean;
  /** Polling interval in live mode (chat, order status...). */
  refetchInterval?: number;
};

/**
 * One hook, two sources: React Query against the backend, or the in-memory
 * demo store when EXPO_PUBLIC_USE_MOCK_API=true. Both hooks always run (the
 * live query is just disabled), so the rules of hooks hold either way.
 */
export function useDualQuery<T>({ key, live, mock, enabled = true, refetchInterval }: DualQuery<T>): Loadable<T> {
  const query = useQuery({
    queryKey: key,
    queryFn: live,
    enabled: isLiveApi && enabled,
    refetchInterval: isLiveApi && enabled ? refetchInterval : false,
  });
  if (!isLiveApi) return { data: enabled ? mock : undefined, isLoading: false, error: null, refetch: noop, isRefetching: false };
  return {
    data: query.data,
    isLoading: enabled && query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
    isRefetching: query.isRefetching,
  };
}

type DualMutation<A, R> = {
  live: (args: A) => Promise<R>;
  mock: (args: A) => R | Promise<R>;
  /** Query key prefixes to refresh after a successful live write. */
  invalidate?: QueryKey[];
};

/** Write counterpart of useDualQuery: `mutateAsync` resolves with the live or mock result. */
export function useDualMutation<A = void, R = unknown>({ live, mock, invalidate = [] }: DualMutation<A, R>) {
  const client = useQueryClient();
  return useMutation<R, unknown, A>({
    mutationFn: async (args) => (isLiveApi ? live(args) : mock(args)),
    onSuccess: async () => {
      if (!isLiveApi) return;
      await Promise.all(invalidate.map((queryKey) => client.invalidateQueries({ queryKey })));
    },
  });
}

/** Fresh key per attempt, sent as `Idempotency-Key` so a retried checkout is not charged twice. */
export function idempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

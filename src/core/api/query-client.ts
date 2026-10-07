import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './problem';

/**
 * The one QueryClient for the app. Exported (not created inside a component)
 * so signing out can drop every cached response of the previous account.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // A 4xx will not fix itself on retry; only network/5xx failures are retried.
      retry: (count, error) => count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { http } from '@/core/api/client';

/**
 * Development-only request log for the UI rebuild (master prompt v5 §3.2): every request the
 * screens make, tagged with the route on screen, so the rebuilt UI can be shown to call the
 * API exactly as before. Off unless Metro is started with EXPO_PUBLIC_API_RECORD=1.
 */
export const API_RECORD = __DEV__ && process.env.EXPO_PUBLIC_API_RECORD === '1';

let route = '(start)';

if (API_RECORD) {
  http.interceptors.request.use((config) => {
    const body: unknown = config.data;
    const keys =
      typeof FormData !== 'undefined' && body instanceof FormData
        ? '<form>'
        : body && typeof body === 'object'
          ? Object.keys(body as Record<string, unknown>).sort().join(',')
          : '';
    console.log(`[API] ${route} | ${(config.method ?? 'get').toUpperCase()} ${config.url ?? ''}${keys ? ` {${keys}}` : ''}`);
    return config;
  });
}

/** Keeps the recorder's route label in step with the screen shown. */
export function ApiRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    route = pathname;
    console.log(`[ROUTE] ${pathname}`);
  }, [pathname]);
  return null;
}

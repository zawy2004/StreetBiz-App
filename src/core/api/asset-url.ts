import { env } from '@/core/config/env';

/**
 * Public files the backend serves (dish photos) come back origin-relative (`/api/uploads/...`),
 * while the API runs on its own host. Resolve them against the API host so an image loads;
 * absolute URLs pass through unchanged. Plain string work: React Native's URL is partial.
 */
export function apiAssetUrl(url: string): string {
  if (!url.startsWith('/api/') || !env.apiBaseUrl) return url;
  const host = env.apiBaseUrl.replace(/\/$/, '').replace(/\/api$/, '');
  return `${host}${url}`;
}

/** Same as `apiAssetUrl`, tolerant of null/undefined (returns undefined). */
export function assetUrl(url: string | null | undefined): string | undefined {
  return url ? apiAssetUrl(url) : undefined;
}

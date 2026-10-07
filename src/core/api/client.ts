import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';

import { env } from '@/core/config/env';

import { ApiError, isTokenFailure, toApiError } from './problem';
import { clearTokens, getAccessToken, getTokens, setTokens, type AuthTokens } from './token-storage';

/** Endpoints that must never carry a bearer token or trigger a refresh retry. */
const ANONYMOUS_PATHS = ['/auth/login', '/auth/register', '/auth/send-otp', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const isAnonymous = (url: string | undefined) => !!url && ANONYMOUS_PATHS.some((path) => url.startsWith(path));

// eslint-disable-next-line import/no-named-as-default-member -- axios.create is the documented API
export const http: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  if (!isAnonymous(config.url)) {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Called when the session cannot be refreshed, so the app drops it and goes
 * back to sign-in. Registered by the auth store (avoids a circular import).
 */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

// One refresh shared by every 401 that arrives while it runs, so concurrent
// requests rotate the refresh token once instead of racing each other.
let refreshInFlight: Promise<AuthTokens> | null = null;

async function refreshTokens(): Promise<AuthTokens> {
  const current = getTokens();
  if (!current?.refreshToken) throw new ApiError('unauthorized', 401, 'Phiên đăng nhập đã hết hạn.');
  const { data } = await axios.post(
    `${env.apiBaseUrl}/auth/refresh`,
    { refreshToken: current.refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20_000 },
  );
  const next: AuthTokens = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessTokenExpiresAtUtc: data.accessTokenExpiresAtUtc,
  };
  setTokens(next);
  return next;
}

function expireSession(): never {
  clearTokens();
  onSessionExpired?.();
  throw new ApiError('unauthorized', 401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
}

http.interceptors.response.use(
  (response) => {
    // ASP.NET renders a null result as 204 with an empty body; normalise it so
    // every `T | null` endpoint really returns null.
    if (response.data === '') response.data = null;
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const canRetry = isTokenFailure(status, error.response?.data) && config && !config._retried && !isAnonymous(config.url);

    if (canRetry) {
      config._retried = true;
      try {
        refreshInFlight ??= refreshTokens().finally(() => {
          refreshInFlight = null;
        });
        const tokens = await refreshInFlight;
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return http.request(config);
      } catch {
        expireSession();
      }
    }
    throw toApiError(status, error.response?.data);
  },
);

/** Typed helpers so feature code never imports axios directly. */
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<T>(url, config);
  return data;
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.post<T>(url, body, config);
  return data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.put<T>(url, body);
  return data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const { data } = await http.delete<T>(url);
  return data;
}

/** "?a=1&b=x" from the params that are set. */
export function queryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

function guessMime(uri: string): string {
  const ext = uri.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'pdf') return 'application/pdf';
  return 'image/jpeg';
}

/**
 * Multipart upload of a local file (an image picker / camera `uri`). Uses fetch
 * rather than axios: React Native builds the multipart body itself from a
 * `{ uri, name, type }` part, while the web build needs a real Blob.
 */
export async function apiUploadFile<T>(url: string, uri: string): Promise<T> {
  const type = guessMime(uri);
  const name = `upload.${type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1]}`;
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, name);
  } else {
    form.append('file', { uri, name, type } as unknown as Blob);
  }

  const send = () => {
    const token = getAccessToken();
    return fetch(`${env.apiBaseUrl}${url}`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  };

  let response: Response;
  try {
    response = await send();
    if (response.status === 401 && getTokens()?.refreshToken) {
      refreshInFlight ??= refreshTokens().finally(() => {
        refreshInFlight = null;
      });
      await refreshInFlight.catch(() => expireSession());
      response = await send();
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw toApiError(undefined, null);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, body);
  return body as T;
}

/** <Image source> for a token-protected upload (evidence photos); the bearer goes in the request header. */
export function protectedImage(url: string): { uri: string; headers?: Record<string, string> } {
  const token = getAccessToken();
  return { uri: url, headers: token ? { Authorization: `Bearer ${token}` } : undefined };
}

/**
 * Files the backend serves come back origin-relative (`/api/uploads/...`); the
 * API runs on its own origin, so resolve them for <Image source>. Absolute URLs
 * pass through. (Evidence files need a token and are not displayed directly.)
 */
export function apiAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith('/api/') || !env.apiBaseUrl) return url;
  const origin = env.apiBaseUrl.replace(/\/api$/, '');
  return `${origin}${url}`;
}

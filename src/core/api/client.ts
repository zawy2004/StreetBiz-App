import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/core/config/env';
import { ApiError, isTokenFailure, timeoutError, toApiError } from './problem';
import { clearTokens, getTokens, setTokens, type AuthTokens } from './token-storage';

/** Endpoints that must never carry a bearer token or trigger a refresh retry. */
const ANONYMOUS_PATHS = [
  '/auth/login',
  '/auth/login-otp',
  '/auth/register',
  '/auth/send-otp',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/chatbot/guest/messages',
];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * Whole-path match. The web matches by prefix, so `/auth/login-history` counts as
 * `/auth/login` and goes out without its bearer token (baseline AC05); the app does not.
 */
function isAnonymous(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0] ?? url;
  return ANONYMOUS_PATHS.includes(path);
}

export const http: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  if (!isAnonymous(config.url)) {
    const token = getTokens()?.accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Called when refreshing fails, so the app can drop the session and route to
 * sign-in. Wired up by the auth store to avoid a circular import.
 */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

// A single in-flight refresh shared by every 401 that arrives while it runs, so
// concurrent requests rotate the refresh token once instead of racing each other.
let refreshInFlight: Promise<AuthTokens> | null = null;

async function refreshTokens(): Promise<AuthTokens> {
  const current = getTokens();
  if (!current?.refreshToken)
    throw new ApiError('unauthorized', 401, 'Phiên đăng nhập đã hết hạn.');

  const response = await axios.post(
    `${env.apiBaseUrl}/auth/refresh`,
    { refreshToken: current.refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 20_000 },
  );

  const next: AuthTokens = {
    accessToken: response.data.accessToken,
    refreshToken: response.data.refreshToken,
    accessTokenExpiresAtUtc: response.data.accessTokenExpiresAtUtc,
  };
  setTokens(next);
  return next;
}

http.interceptors.response.use(
  (response) => {
    // ASP.NET renders a null result as 204 No Content, and axios surfaces that empty
    // body as "". An empty string is not nullish, so `data?.field` walks straight past
    // the optional chain and throws on the next property access. Normalising to null
    // keeps every `T | null` endpoint honest at the one place they all pass through.
    if (response.data === '') response.data = null;
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    // With responseType "blob" (file downloads) the error body is a Blob too; read it
    // back into text or JSON so the checks below see what the server sent.
    if (error.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        error.response.data = text ? JSON.parse(text) : '';
      } catch {
        error.response.data = text;
      }
    }

    // Only a token failure is worth a refresh: a handler that answers 401 for another
    // reason would otherwise rotate the session for nothing. In mock mode the signed-in
    // user is a demo account the backend never issued, so a 401 from a module that still
    // calls the server is that request's error, not the end of the demo session.
    const canRetry =
      !env.useMockApi &&
      isTokenFailure(status, error.response?.data) &&
      config &&
      !config._retried &&
      !isAnonymous(config.url);

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
        clearTokens();
        onSessionExpired?.();
        throw new ApiError(
          'unauthorized',
          401,
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        );
      }
    }

    // axios gives up after its timeout with no response: say the server was slow, not that the
    // connection is down (the eKYC calls used to report "không kết nối được máy chủ" here).
    if (
      !error.response &&
      (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT)
    ) {
      throw timeoutError();
    }

    throw toApiError(status, error.response?.data);
  },
);

/** Thin typed helpers so feature modules never import axios directly. */
export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<T>(url, config);
  return data;
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
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

/** Multipart upload. The explicit content type stops axios turning FormData into JSON. */
export async function apiUpload<T>(url: string, form: FormData): Promise<T> {
  const { data } = await http.post<T>(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
  });
  return data;
}

export async function apiGetBlob(url: string): Promise<Blob> {
  const { data } = await http.get<Blob>(url, { responseType: 'blob' });
  return data;
}

/**
 * File URLs stored by the backend are origin-relative (`/api/uploads/...`), while
 * the client's baseURL already ends in `/api`; drop the duplicate segment.
 */
export function apiPathFromFileUrl(fileUrl: string): string {
  return fileUrl.startsWith('/api/') ? fileUrl.slice('/api'.length) : fileUrl;
}

/**
 * Runs a `fetch`-style request (path + RequestInit) through the shared axios client, so the
 * modules the web wrote with their own `fetch` wrapper (side, platform, community) get the
 * same bearer token, refresh-and-retry and ProblemDetails mapping as every other call.
 */
export async function requestViaHttp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const body = init.body;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let data: unknown = undefined;
  if (typeof body === 'string') {
    try {
      data = JSON.parse(body);
    } catch {
      data = body;
    }
  } else if (body != null) {
    data = body;
  }
  const response = await http.request<T>({
    url: path,
    method: (init.method ?? 'GET') as AxiosRequestConfig['method'],
    data,
    headers: isForm ? { 'Content-Type': 'multipart/form-data' } : undefined,
    timeout: isForm ? 60_000 : 20_000,
  });
  return response.data;
}

/**
 * Downloads a protected file (evidence, invoice PDF …) into the app cache and returns its
 * local `file://` URI: the app's answer to the web's `URL.createObjectURL(blob)`. The bearer
 * token goes in the request headers; a fresh token is tried once if the first one is stale.
 */
export async function downloadToCache(fileUrl: string, fileName?: string): Promise<string> {
  const { File, Directory, Paths } = await import('expo-file-system');
  const path = apiPathFromFileUrl(fileUrl);
  const url = `${env.apiBaseUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  const dir = new Directory(Paths.cache, 'streetbiz-files');
  if (!dir.exists) dir.create({ intermediates: true });
  const name = fileName ?? (path.split('/').pop()?.split('?')[0] || `file-${Date.now()}`);
  const target = new File(dir, name);
  if (target.exists) target.delete();
  const attempt = async () => {
    const token = getTokens()?.accessToken;
    return File.downloadFileAsync(url, target, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };
  try {
    return (await attempt()).uri;
  } catch {
    // Likely an expired access token: refresh through a cheap authenticated call, then retry once.
    await http.get('/auth/sessions').catch(() => undefined);
    return (await attempt()).uri;
  }
}

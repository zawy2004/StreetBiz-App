import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Access/refresh token persistence. The backend returns a bearer access token
 * plus an opaque refresh token (no cookie), so the app keeps both: in the
 * device keychain/keystore on phones, in localStorage on the web build.
 *
 * Reads are synchronous (the HTTP interceptor needs the token immediately), so
 * the stored value is loaded into memory once at startup by `hydrateTokens`.
 */
const STORAGE_KEY = 'streetbiz-tokens';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  /** ISO-8601 UTC instant the access token stops being accepted. */
  accessTokenExpiresAtUtc: string;
};

let cached: AuthTokens | null = null;
let hydrated = false;

const web = Platform.OS === 'web';

async function readStored(): Promise<string | null> {
  if (web) return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function writeStored(value: string | null): Promise<void> {
  try {
    if (web) {
      if (typeof localStorage === 'undefined') return;
      if (value === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, value);
      return;
    }
    if (value === null) await SecureStore.deleteItemAsync(STORAGE_KEY);
    else await SecureStore.setItemAsync(STORAGE_KEY, value);
  } catch {
    // The in-memory copy still serves this run; the session just won't survive a restart.
  }
}

/** Loads the saved tokens into memory. Safe to call more than once. */
export async function hydrateTokens(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await readStored();
    cached = raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    cached = null;
  }
  hydrated = true;
}

export function getTokens(): AuthTokens | null {
  return cached;
}

export function getAccessToken(): string | null {
  return cached?.accessToken ?? null;
}

export function setTokens(tokens: AuthTokens): void {
  cached = tokens;
  void writeStored(JSON.stringify(tokens));
}

export function clearTokens(): void {
  cached = null;
  void writeStored(null);
}

import * as SecureStore from 'expo-secure-store';

/**
 * Access/refresh token persistence (the app's version of the web's `token-storage.ts`).
 *
 * Tokens live in the OS keystore (`expo-secure-store`: Keychain on iOS, Keystore-backed
 * encrypted storage on Android), never in AsyncStorage. Reads stay synchronous for the
 * axios interceptor: `hydrateTokens()` loads the stored pair once at launch into memory,
 * and every write updates memory first, then the keystore in the background.
 */
const STORAGE_KEY = 'streetbiz-tokens';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  /** ISO-8601 UTC instant the access token stops being accepted. */
  accessTokenExpiresAtUtc: string;
};

let cached: AuthTokens | null = null;

/** Loads the stored tokens; call once before the first authenticated request. */
export async function hydrateTokens(): Promise<AuthTokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function getTokens(): AuthTokens | null {
  return cached;
}

export function setTokens(tokens: AuthTokens): void {
  cached = tokens;
  void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(tokens)).catch(() => {
    // Keystore unavailable: the in-memory copy still serves this launch.
  });
}

export function clearTokens(): void {
  cached = null;
  void SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => undefined);
}

export function getAccessToken(): string | null {
  return cached?.accessToken ?? null;
}

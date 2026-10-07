import Constants from 'expo-constants';
import { Platform } from 'react-native';

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

/**
 * `localhost` in the API URL means "the machine running the dev server". That
 * is right on the web and the iOS simulator, but a phone (or the Android
 * emulator) would look for the API on itself. Expo knows the dev machine's LAN
 * address (`hostUri`, e.g. "192.168.1.20:8081"), so swap it in there.
 */
function resolveApiBaseUrl(raw: string): string {
  const url = raw.trim().replace(/\/$/, '');
  if (!url || Platform.OS === 'web') return url;
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (!devHost) return url;
  return url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${devHost}`);
}

// EXPO_PUBLIC_* must be read as literal `process.env.EXPO_PUBLIC_X` so Expo can
// inline them at build time. They ship inside the app: never put secrets here.
export const env = {
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  apiBaseUrl: resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL ?? ''),
  /**
   * true runs every screen on the in-memory demo data in `src/mocks` (no
   * backend needed); false calls StreetBiz-BE at `apiBaseUrl`.
   */
  useMockApi: bool(process.env.EXPO_PUBLIC_USE_MOCK_API, false),
  /** Shows "thanh toán thử" buttons that call the backend's Development-only sandbox endpoints. */
  enablePaymentSandbox: bool(process.env.EXPO_PUBLIC_ENABLE_PAYMENT_SANDBOX),
  enableAiCompliance: bool(process.env.EXPO_PUBLIC_ENABLE_AI_COMPLIANCE),
} as const;

export const isDev = env.appEnv === 'development';

/** True when screens read and write StreetBiz-BE instead of the demo data. */
export const isLiveApi = !env.useMockApi && env.apiBaseUrl.length > 0;

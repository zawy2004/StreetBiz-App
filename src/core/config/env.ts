import Constants from 'expo-constants';

/**
 * Runtime switches (the app's version of StreetBiz-FE `core/config/env.ts`).
 *
 * The API address, in order:
 * 1. `EXPO_PUBLIC_API_BASE_URL` when set (a real server, or any fixed address);
 * 2. in development, the machine Metro runs on, port 5023 (the API's `http` profile):
 *    Expo's host URI is the computer's LAN address on a phone, and 127.0.0.1 on an
 *    emulator with `adb reverse tcp:5023 tcp:5023`, so both reach the local backend.
 */
function devApiBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const host = hostUri.split(':')[0] || 'localhost';
  const port = process.env.EXPO_PUBLIC_API_PORT ?? '5023';
  return `http://${host}:${port}/api`;
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

export const env = {
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || devApiBaseUrl(),
  /** Mock data only on request; the app talks to StreetBiz-BE by default. */
  useMockApi: bool(process.env.EXPO_PUBLIC_USE_MOCK_API),
  /** Advisory [AI] panels (price hint, proposal assessment, geofence drift): on, as in the web's .env. */
  enableAiCompliance: bool(process.env.EXPO_PUBLIC_ENABLE_AI_COMPLIANCE, true),
  enableChatbot: bool(process.env.EXPO_PUBLIC_ENABLE_CHATBOT, true),
  /** Ordering is live on the backend and the web, so it is on in the app too. */
  enablePhase2: bool(process.env.EXPO_PUBLIC_ENABLE_PHASE_2, true),
  enablePushNotifications: bool(process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS),
  /** Sandbox payment buttons, as on the web's development build. */
  enablePaymentSandbox: bool(process.env.EXPO_PUBLIC_ENABLE_PAYMENT_SANDBOX, true),
  /**
   * Đà Nẵng's own citizen feedback channel (1022): the phone line and Góp ý Đà Nẵng. StreetBiz
   * links to it for anyone who would rather not sign up; it never replaces it.
   */
  cityFeedbackPhone: process.env.EXPO_PUBLIC_CITY_FEEDBACK_PHONE || '02361022',
  cityFeedbackUrl: process.env.EXPO_PUBLIC_CITY_FEEDBACK_URL || 'https://gopy.danang.gov.vn',
} as const;

export const isDev = env.appEnv === 'development';

/** True when screens should call StreetBiz-BE (always, unless mock data is switched on). */
export const isLiveApi = !env.useMockApi && env.apiBaseUrl.length > 0;

/** Thrown by a data function that is not wired to the server, so the screen shows its error state instead of fake data. */
export class NotWiredError extends Error {
  constructor() {
    super('Màn này chưa nối máy chủ.');
  }
}

import type { RoleCode } from '@/core/types/role';
import { apiDelete, apiGet, apiPost } from './client';

/**
 * Mirrors StreetBiz-BE `AuthController` (AUTH-01…AUTH-09).
 * See StreetBiz-BE/docs/auth-vendor-onboarding.md.
 */

/** OtpChallenges.purpose values — `AppConstants.OtpPurposes` on the backend. */
export const OTP_PURPOSE = {
  register: 'REGISTRATION',
  passwordReset: 'PASSWORD_RESET',
  login: 'LOGIN',
} as const;

export type OtpPurpose = (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE];

export type ApiUser = {
  userId: number;
  phoneNumber: string;
  fullName: string | null;
  roleCode: RoleCode;
  wardUnitId: number | null;
  accountStatus: string;
};

export type AuthResult = {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  user: ApiUser;
};

export type ApiSession = {
  sessionId: number;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  expiresAt: string;
  isCurrent: boolean;
};

/**
 * One row of the caller's own sign-in / security history.
 * Mirrors `SecurityEvent(long Id, string Action, string? Details, DateTime CreatedAt)`.
 * `action` is one of LOGIN_SUCCESS, LOGIN_FAILED, PASSWORD_CHANGED, PASSWORD_RESET,
 * SESSION_REVOKED, SECURITY_ALERT.
 */
export type SecurityEvent = {
  id: number;
  action: string;
  details: string | null;
  createdAt: string;
};

export type RegisterPayload = {
  phoneNumber: string;
  password: string;
  fullName: string | null;
  roleCode: Extract<RoleCode, 'CUSTOMER' | 'VENDOR'>;
  wardUnitId: number | null;
  otp: string;
};

export const authApi = {
  /** AUTH-02 */
  sendOtp: (phoneNumber: string, purpose: OtpPurpose) =>
    apiPost<{ message: string }>('/auth/send-otp', { phoneNumber, purpose }),

  /** AUTH-01 — the backend signs the new account in straight away. */
  register: (payload: RegisterPayload) => apiPost<AuthResult>('/auth/register', payload),

  /** AUTH-03 */
  login: (phoneNumber: string, password: string) =>
    apiPost<AuthResult>('/auth/login', { phoneNumber, password }),

  /** AUTH-03 — passwordless sign-in with the OTP sent to a registered phone (FE-01, BR-03). */
  loginWithOtp: (phoneNumber: string, otp: string) =>
    apiPost<AuthResult>('/auth/login-otp', { phoneNumber, otp }),

  /** AUTH-04 */
  logout: () => apiPost<{ message: string }>('/auth/logout'),

  /** AUTH-07 */
  changePassword: (currentPassword: string, newPassword: string) =>
    apiPost<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),

  /** AUTH-05 — deliberately uniform: it never reveals whether the phone exists. */
  forgotPassword: (phoneNumber: string) =>
    apiPost<{ message: string }>('/auth/forgot-password', { phoneNumber }),

  /** AUTH-06 */
  resetPassword: (phoneNumber: string, otp: string, newPassword: string) =>
    apiPost<{ message: string }>('/auth/reset-password', { phoneNumber, otp, newPassword }),

  /** AUTH-08 */
  listSessions: () => apiGet<ApiSession[]>('/auth/sessions'),

  /** AUTH-09 */
  revokeSession: (sessionId: number) =>
    apiDelete<{ message: string }>(`/auth/sessions/${sessionId}`),

  /** AUTH-09 — sign out of every other device, keeping the current session. */
  revokeOtherSessions: () => apiDelete<{ message: string }>('/auth/sessions'),

  /** The caller's own sign-in and security history, newest first (paged with `before`). */
  listLoginHistory: (take = 20, before?: number) =>
    apiGet<SecurityEvent[]>('/auth/login-history', {
      params: { take, ...(before != null ? { before } : {}) },
    }),
};

export type Ward = {
  unitId: number;
  unitName: string;
  parentName: string | null;
};

export const referenceApi = {
  listWards: () => apiGet<Ward[]>('/administrative-units/wards'),
};

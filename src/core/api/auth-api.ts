import type { RoleCode } from '@/core/types/role';

import { apiDelete, apiGet, apiPost } from './client';

/** Mirrors StreetBiz-BE `AuthController` (AUTH-01…AUTH-09). */

/** OtpChallenges.purpose — `AppConstants.OtpPurposes` on the backend. */
export const OTP_PURPOSE = { register: 'REGISTRATION', passwordReset: 'PASSWORD_RESET' } as const;
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

export type RegisterPayload = {
  phoneNumber: string;
  password: string;
  fullName: string | null;
  roleCode: Extract<RoleCode, 'CUSTOMER' | 'VENDOR'>;
  wardUnitId: number | null;
  otp: string;
};

export type Ward = { unitId: number; unitName: string; parentName: string | null };

export const authApi = {
  /** AUTH-02. In Development the OTP is printed to the API console as a [DEV-SMS] line. */
  sendOtp: (phoneNumber: string, purpose: OtpPurpose) => apiPost<{ message: string }>('/auth/send-otp', { phoneNumber, purpose }),
  /** AUTH-01 — the backend signs the new account in straight away. */
  register: (payload: RegisterPayload) => apiPost<AuthResult>('/auth/register', payload),
  /** AUTH-03 */
  login: (phoneNumber: string, password: string) => apiPost<AuthResult>('/auth/login', { phoneNumber, password }),
  /** AUTH-04 */
  logout: () => apiPost<{ message: string }>('/auth/logout'),
  /** AUTH-07 */
  changePassword: (currentPassword: string, newPassword: string) =>
    apiPost<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),
  /** AUTH-05 — deliberately uniform: never reveals whether the phone exists. */
  forgotPassword: (phoneNumber: string) => apiPost<{ message: string }>('/auth/forgot-password', { phoneNumber }),
  /** AUTH-06 */
  resetPassword: (phoneNumber: string, otp: string, newPassword: string) =>
    apiPost<{ message: string }>('/auth/reset-password', { phoneNumber, otp, newPassword }),
  /** AUTH-08 */
  listSessions: () => apiGet<ApiSession[]>('/auth/sessions'),
  /** AUTH-09 */
  revokeSession: (sessionId: number) => apiDelete<{ message: string }>(`/auth/sessions/${sessionId}`),
  listWards: () => apiGet<Ward[]>('/administrative-units/wards'),
};

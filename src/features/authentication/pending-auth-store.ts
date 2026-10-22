import { create } from 'zustand';

/**
 * Carries in-progress sign-up / password-reset data between screens.
 *
 * Deliberately memory-only (no `persist`) and never put in the URL: the
 * registration password would otherwise land in browser history, server logs
 * and the Referer header. A reload drops it, and the screens send the user back
 * to the start of the flow.
 */
export type PendingRegistration = {
  phoneNumber: string;
  fullName: string;
  password: string;
  roleCode: 'CUSTOMER' | 'VENDOR';
  wardUnitId: number | null;
};

export type PendingReset = {
  phoneNumber: string;
  /** Set once the user has typed the code; the backend checks it on reset. */
  otp?: string;
};

type PendingAuthState = {
  registration: PendingRegistration | null;
  reset: PendingReset | null;
  /** Seconds left on the backend's OTP resend cooldown when the flow started. */
  resendAvailableIn: number | null;
  startRegistration: (registration: PendingRegistration, resendAvailableIn?: number) => void;
  startReset: (phoneNumber: string) => void;
  setResetOtp: (otp: string) => void;
  clear: () => void;
};

export const usePendingAuthStore = create<PendingAuthState>((set) => ({
  registration: null,
  reset: null,
  resendAvailableIn: null,
  startRegistration: (registration, resendAvailableIn) =>
    set({ registration, reset: null, resendAvailableIn: resendAvailableIn ?? null }),
  startReset: (phoneNumber) =>
    set({ reset: { phoneNumber }, registration: null, resendAvailableIn: null }),
  setResetOtp: (otp) => set((s) => (s.reset ? { reset: { ...s.reset, otp } } : s)),
  clear: () => set({ registration: null, reset: null, resendAvailableIn: null }),
}));

import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import {
  authApi,
  clearTokens,
  getTokens,
  setSessionExpiredHandler,
  setTokens,
  type ApiUser,
  type AuthResult,
  type RegisterPayload,
} from '@/core/api';
import { hydrateTokens } from '@/core/api/token-storage';
import { isWebOnlyRole, WEB_ONLY_SIGN_IN_MESSAGE } from '@/core/auth/role-routes';
import type { RoleCode } from '@/core/types/role';

/**
 * Session state (the app's version of StreetBiz-FE `store/auth-store.ts`), always against
 * StreetBiz-BE. The user keeps the web's shape (`role_code`, `wardUnitId` …) so code ported
 * from the web reads it unchanged. The profile is kept in the keystore next to the tokens,
 * because the backend has no "who am I" endpoint to ask at launch.
 */
export type AppUser = {
  id: string;
  fullName: string;
  phone: string;
  role_code: RoleCode;
  wardUnitId?: number;
  account_status: 'ACTIVE' | 'SUSPENDED';
};

const USER_KEY = 'streetbiz-user';

function toAppUser(apiUser: ApiUser): AppUser {
  return {
    id: String(apiUser.userId),
    fullName: apiUser.fullName ?? apiUser.phoneNumber,
    phone: apiUser.phoneNumber,
    role_code: apiUser.roleCode,
    wardUnitId: apiUser.wardUnitId ?? undefined,
    account_status: apiUser.accountStatus === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
  };
}

function persistUser(user: AppUser | null) {
  void (
    user
      ? SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
      : SecureStore.deleteItemAsync(USER_KEY)
  ).catch(() => undefined);
}

function applyAuthResult(result: AuthResult): AppUser {
  const user = toAppUser(result.user);
  // The phone app holds no web-only session: undo the sign-in and tell the caller why.
  if (isWebOnlyRole(user.role_code)) {
    clearTokens();
    persistUser(null);
    throw new Error(WEB_ONLY_SIGN_IN_MESSAGE);
  }
  setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessTokenExpiresAtUtc: result.accessTokenExpiresAtUtc,
  });
  persistUser(user);
  return user;
}

type AuthState = {
  /** False until the stored session has been read at launch (the splash stays up until then). */
  ready: boolean;
  user: AppUser | null;
  /** Set when a refresh failed, so the sign-in screen can explain why. */
  sessionExpired: boolean;
  bootstrap: () => Promise<void>;
  signIn: (phone: string, password: string) => Promise<AppUser>;
  /** Passwordless sign-in: the phone proves itself with the OTP it was sent. */
  signInWithOtp: (phone: string, otp: string) => Promise<AppUser>;
  register: (payload: RegisterPayload) => Promise<AppUser>;
  signOut: () => Promise<void>;
  clearSessionExpired: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  user: null,
  sessionExpired: false,

  bootstrap: async () => {
    const [tokens, rawUser] = await Promise.all([
      hydrateTokens(),
      SecureStore.getItemAsync(USER_KEY).catch(() => null),
    ]);
    let user: AppUser | null = null;
    try {
      user = rawUser ? (JSON.parse(rawUser) as AppUser) : null;
    } catch {
      user = null;
    }
    // A profile without tokens would look signed in while every call fails: drop it.
    // A web-only role (platform admin) has no area on the phone: drop it too.
    if (user && (!tokens || isWebOnlyRole(user.role_code))) {
      user = null;
      clearTokens();
      persistUser(null);
    }
    set({ user, ready: true });
  },

  signIn: async (phone, password) => {
    const user = applyAuthResult(await authApi.login(phone, password));
    set({ user, sessionExpired: false });
    return user;
  },

  signInWithOtp: async (phone, otp) => {
    const user = applyAuthResult(await authApi.loginWithOtp(phone, otp));
    set({ user, sessionExpired: false });
    return user;
  },

  /** The backend signs the new account in straight away (AUTH-01). */
  register: async (payload) => {
    const user = applyAuthResult(await authApi.register(payload));
    set({ user, sessionExpired: false });
    return user;
  },

  signOut: async () => {
    // Best effort: an expired or revoked session must not trap the user in a signed-in UI.
    if (getTokens()) {
      try {
        await authApi.logout();
      } catch {
        /* ignore */
      }
    }
    clearTokens();
    persistUser(null);
    set({ user: null, sessionExpired: false });
  },

  clearSessionExpired: () => set({ sessionExpired: false }),
}));

// When the refresh token is rejected, drop the user so the guards route to sign-in.
setSessionExpiredHandler(() => {
  persistUser(null);
  useAuthStore.setState({ user: null, sessionExpired: true });
});

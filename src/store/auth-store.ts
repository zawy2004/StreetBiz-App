import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { authApi, type ApiUser, type AuthResult } from '@/core/api/auth-api';
import { setSessionExpiredHandler } from '@/core/api/client';
import { ApiError } from '@/core/api/problem';
import { queryClient } from '@/core/api/query-client';
import { clearTokens, setTokens } from '@/core/api/token-storage';
import { isLiveApi } from '@/core/config/env';
import type { RoleCode } from '@/core/types/role';
import { useMockDb } from '@/mocks/db';

/** The signed-in account, the same shape whether it came from StreetBiz-BE or the demo data. */
export type SessionUser = {
  id: string;
  fullName: string;
  phone: string;
  role_code: RoleCode;
  account_status: 'ACTIVE' | 'SUSPENDED';
  wardUnitId?: number;
  /** Demo data only: the live API resolves the vendor from the token. */
  vendorId?: string;
  /** Demo data only (the mock change-password check). */
  password?: string;
};

type AuthState = {
  user: SessionUser | null;
  /** Resolves with the account, or rejects with an ApiError carrying the backend's message. */
  signIn: (phone: string, password: string) => Promise<SessionUser>;
  /** Stores a session the backend just issued (login, register). */
  acceptSession: (result: AuthResult) => SessionUser;
  signOut: () => void;
};

const digits = (value: string) => value.replace(/\D/g, '');

export function toSessionUser(user: ApiUser): SessionUser {
  return {
    id: String(user.userId),
    fullName: user.fullName ?? user.phoneNumber,
    phone: user.phoneNumber,
    role_code: user.roleCode,
    account_status: user.accountStatus === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
    wardUnitId: user.wardUnitId ?? undefined,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,

      signIn: async (phone, password) => {
        if (isLiveApi) {
          const result = await authApi.login(digits(phone), password);
          return get().acceptSession(result);
        }
        const match = useMockDb.getState().users.find((u) => digits(u.phone) === digits(phone) && u.password === password);
        if (!match || match.account_status !== 'ACTIVE') {
          throw new ApiError('unauthorized', 401, 'Sai số điện thoại hoặc mật khẩu');
        }
        set({ user: match });
        return match;
      },

      acceptSession: (result) => {
        setTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          accessTokenExpiresAtUtc: result.accessTokenExpiresAtUtc,
        });
        const user = toSessionUser(result.user);
        set({ user });
        return user;
      },

      signOut: () => {
        // Revoke the server session in the background; the device forgets it either way.
        if (isLiveApi) void authApi.logout().catch(() => undefined);
        clearTokens();
        queryClient.clear();
        set({ user: null });
      },
    }),
    {
      name: 'streetbiz-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user }),
    },
  ),
);

// A refresh that fails (token revoked, expired refresh token) ends the session;
// the role layouts then send the visitor back to the front door.
setSessionExpiredHandler(() => {
  queryClient.clear();
  useAuthStore.setState({ user: null });
});

/** True once the persisted session has been read, so guards do not redirect too early. */
export function useAuthHydrated() {
  return useSyncExternalStore(
    (notify) => useAuthStore.persist.onFinishHydration(notify),
    () => useAuthStore.persist.hasHydrated(),
    () => true,
  );
}

export { ROLE_HOME } from '@/core/auth/role-routes';

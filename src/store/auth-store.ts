import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { RoleCode } from '@/core/types/role';
import { useMockDb } from '@/mocks/db';
import type { MockUser } from '@/mocks/types';

type AuthState = {
  user: MockUser | null;
  signIn: (phone: string, password: string) => 'ok' | 'invalid';
  signOut: () => void;
};

const digits = (value: string) => value.replace(/\D/g, '');

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      signIn: (phone, password) => {
        const match = useMockDb
          .getState()
          .users.find((u) => digits(u.phone) === digits(phone) && u.password === password);
        if (!match || match.account_status !== 'ACTIVE') return 'invalid';
        set({ user: match });
        return 'ok';
      },

      signOut: () => set({ user: null }),
    }),
    {
      name: 'streetbiz-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user }),
    },
  ),
);

/** True once the persisted session has been read, so guards do not redirect too early. */
export function useAuthHydrated() {
  return useSyncExternalStore(
    (notify) => useAuthStore.persist.onFinishHydration(notify),
    () => useAuthStore.persist.hasHydrated(),
    () => true,
  );
}

export const ROLE_HOME: Record<RoleCode, string> = {
  CUSTOMER: '/customer/explore',
  VENDOR: '/vendor/home',
  WARD_AUTHORITY: '/ward/patrol',
  PLATFORM_ADMIN: '/customer/explore',
};

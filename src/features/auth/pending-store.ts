import { create } from 'zustand';

import type { NewAccount } from './create-account';

type Pending = {
  account: NewAccount | null;
  /** Phone number a password reset was requested for. */
  resetPhone: string | null;
  setAccount: (account: NewAccount | null) => void;
  setResetPhone: (phone: string | null) => void;
};

/** Holds data between the multi-screen sign-up and reset flows; never persisted. */
export const usePendingAuth = create<Pending>((set) => ({
  account: null,
  resetPhone: null,
  setAccount: (account) => set({ account }),
  setResetPhone: (resetPhone) => set({ resetPhone }),
}));

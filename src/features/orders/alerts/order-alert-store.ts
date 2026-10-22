import { create } from 'zustand';

type OrderAlertState = {
  /** Announce new orders with a buzz and a toast. On by default; a seller thinks "tell me". */
  alerts: boolean;
  /** Whether the realtime socket is up; polling covers for it when it is not. */
  live: boolean;
  setAlerts: (alerts: boolean) => void;
  setLive: (live: boolean) => void;
};

/** In memory: the socket state is about this app run, and alerts default back on. */
export const useOrderAlertStore = create<OrderAlertState>()((set) => ({
  alerts: true,
  live: false,
  setAlerts: (alerts) => set({ alerts }),
  setLive: (live) => set({ live }),
}));

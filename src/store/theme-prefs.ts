import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePrefs = {
  /** `null` follows the device setting. */
  scheme: 'light' | 'dark' | null;
  setScheme: (scheme: 'light' | 'dark' | null) => void;
};

export const useThemePrefs = create<ThemePrefs>()(
  persist(
    (set) => ({
      scheme: null,
      setScheme: (scheme) => set({ scheme }),
    }),
    { name: 'streetbiz-theme', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const toPreference = (scheme: 'light' | 'dark' | null): ThemePreference => scheme ?? 'system';
export const fromPreference = (pref: ThemePreference) => (pref === 'system' ? null : pref);

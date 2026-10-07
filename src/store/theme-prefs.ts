import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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

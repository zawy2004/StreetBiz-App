import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, statusTones, type ColorTokens, type ToneColors, type StatusTone } from './colors';

type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  tones: Record<StatusTone, ToneColors>;
};

function build(scheme: 'light' | 'dark'): Theme {
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return { scheme, colors, tones: statusTones(colors) };
}

const ThemeContext = createContext<Theme>(build('light'));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = useMemo(() => build(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

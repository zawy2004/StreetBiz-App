import { Platform, type ViewStyle } from 'react-native';

import type { ColorTokens } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

/** Screen edge margin and minimum touch target. */
export const layout = {
  screenMargin: 16,
  touch: 48,
  input: 48,
} as const;

export const radius = {
  control: 12,
  card: 18,
  chip: 14,
  sheet: 26,
  full: 999,
} as const;

export type Elevation = { card: ViewStyle; raised: ViewStyle; bar: ViewStyle };

/**
 * Soft, low-contrast shadows in light mode; dark mode leans on borders and
 * surface steps instead, since shadows disappear against a near-black page.
 */
export function elevation(scheme: 'light' | 'dark', colors: ColorTokens): Elevation {
  const dark = scheme === 'dark';
  const make = (opacity: number, blur: number, y: number, android: number): ViewStyle =>
    Platform.select<ViewStyle>({
      ios: { shadowColor: colors.shadow, shadowOpacity: dark ? opacity * 2.5 : opacity, shadowRadius: blur, shadowOffset: { width: 0, height: y } },
      android: { elevation: dark ? 0 : android },
      web: { boxShadow: dark ? 'none' : `0 ${y}px ${blur * 2}px rgba(26, 34, 48, ${opacity})` } as ViewStyle,
      default: {},
    })!;
  return {
    card: make(0.06, 10, 3, 1),
    raised: make(0.12, 18, 8, 6),
    bar: make(0.06, 12, -2, 8),
  };
}

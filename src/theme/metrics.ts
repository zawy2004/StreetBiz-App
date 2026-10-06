import { Platform, type ViewStyle } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

/** Screen edge margin and minimum touch target, from the Stitch design system. */
export const layout = {
  screenMargin: 16,
  touch: 48,
} as const;

export const radius = {
  control: 4,
  card: 8,
  chip: 12,
  full: 999,
} as const;

/** Level 2 (sticky bars, sheets): one crisp offset shadow, no blur-heavy glow. */
export const stickyShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#1D2939',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: -2 },
  },
  android: { elevation: 4 },
  default: {},
})!;

import { Easing } from 'react-native-reanimated';

/** 4/8 grid; screen gutter 16 (native margin), sections 28 apart. */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 28, xxl: 40 } as const;

/**
 * One radius rule: chips and buttons are capsules, controls 12, cards 20, photos inside
 * cards 14, the permit pass 24, sheets come from the system. Always with continuous curves.
 */
export const radius = { control: 12, photo: 14, card: 20, pass: 24, full: 999 } as const;

/** Minimum touch targets: buyers 44, vendors and ward officers 48 (outdoor, one hand). */
export const touch = { buyer: 44, worker: 48 } as const;

/** One elevation system, as CSS box shadows (the native shadow props are legacy). */
export const shadow = {
  card: '0 1px 2px rgba(17, 28, 43, 0.06), 0 8px 24px -12px rgba(17, 28, 43, 0.18)',
  raised: '0 2px 4px rgba(17, 28, 43, 0.06), 0 18px 40px -16px rgba(17, 28, 43, 0.30)',
} as const;

/** Motion vocabulary (expo-animation): strong ease-out for UI, springs where a finger is. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const spring = {
  settle: { duration: 400, dampingRatio: 1 },
  stamp: { duration: 420, dampingRatio: 0.72 },
} as const;

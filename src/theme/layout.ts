import { Easing } from 'react-native-reanimated';

/** 4/8 grid; screen gutter 16 (native margin), sections 28 apart. */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 28, xxl: 40 } as const;

/**
 * Shape lock v5: buttons, chips, search and pills are capsules; slot plates 6; price stickers 8;
 * inputs and tiles 14; photos 18; cards 22; passes (permit, pickup ticket) 26. Sheets come from
 * the system. Always continuous curves; no other radius.
 */
export const radius = { plate: 6, sticker: 8, control: 14, photo: 18, card: 22, pass: 26, full: 999 } as const;

/** Minimum touch targets: buyers 44, vendors and ward officers 48 (outdoor, one hand). */
export const touch = { buyer: 44, worker: 48 } as const;

/** One elevation system, as CSS box shadows (the native shadow props are legacy). */
export const shadow = {
  /** Resting surfaces that sit on the canvas (cards, tiles). */
  card: '0 1px 2px rgba(17, 28, 43, 0.05), 0 10px 26px -14px rgba(17, 28, 43, 0.28)',
  /** Things that float over content (search on the signboard, floating bars, passes). */
  raised: '0 2px 6px rgba(17, 28, 43, 0.08), 0 18px 40px -16px rgba(17, 28, 43, 0.42)',
  /** The orange glow under a lit stall or the primary action. */
  glow: '0 12px 26px -10px rgba(238, 85, 0, 0.55)',
} as const;

/** Motion vocabulary (expo-animation): strong ease-out for UI, springs where a finger is. */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const spring = {
  settle: { duration: 400, dampingRatio: 1 },
  stamp: { duration: 420, dampingRatio: 0.72 },
} as const;

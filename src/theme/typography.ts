import type { TextStyle } from 'react-native';

export const fontFamilies = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  extrabold: 'BeVietnamPro_800ExtraBold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

// Line heights stay >= 1.2x so Vietnamese diacritics never collide.
export const typography = {
  hero: { fontFamily: fontFamilies.extrabold, fontSize: 32, lineHeight: 40, letterSpacing: -0.8 },
  display: { fontFamily: fontFamilies.extrabold, fontSize: 26, lineHeight: 33, letterSpacing: -0.6 },
  title: { fontFamily: fontFamilies.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  headline: { fontFamily: fontFamilies.semibold, fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },
  bodyLg: { fontFamily: fontFamilies.regular, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fontFamilies.regular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamilies.medium, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 },
  labelSm: { fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: fontFamilies.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  badge: { fontFamily: fontFamilies.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  money: { fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 24, fontVariant: tabular },
  moneyLg: { fontFamily: fontFamilies.extrabold, fontSize: 30, lineHeight: 38, letterSpacing: -0.5, fontVariant: tabular },
  code: { fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 22, fontVariant: tabular },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof typography;

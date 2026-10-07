import type { TextStyle } from 'react-native';

export const fontFamilies = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  extrabold: 'BeVietnamPro_800ExtraBold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

// Scale from the "Civic Paper & Transit" design system. Line heights stay >= 1.3x
// so Vietnamese diacritics never collide.
export const typography = {
  display: { fontFamily: fontFamilies.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  title: { fontFamily: fontFamilies.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  headline: { fontFamily: fontFamilies.semibold, fontSize: 17, lineHeight: 22 },
  bodyLg: { fontFamily: fontFamilies.regular, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fontFamilies.regular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 },
  labelSm: { fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 18 },
  badge: { fontFamily: fontFamilies.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  money: { fontFamily: fontFamilies.bold, fontSize: 17, lineHeight: 24, fontVariant: tabular },
  moneyLg: { fontFamily: fontFamilies.extrabold, fontSize: 28, lineHeight: 36, fontVariant: tabular },
  code: { fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 22, fontVariant: tabular },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof typography;

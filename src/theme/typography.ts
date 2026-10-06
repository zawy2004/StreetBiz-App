import type { TextStyle } from 'react-native';

export const fontFamilies = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  extrabold: 'BeVietnamPro_800ExtraBold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

// Line heights stay at 1.35x or more so Vietnamese diacritics never collide.
export const typography = {
  display: { fontFamily: fontFamilies.bold, fontSize: 26, lineHeight: 34 },
  title: { fontFamily: fontFamilies.bold, fontSize: 20, lineHeight: 28 },
  headline: { fontFamily: fontFamilies.semibold, fontSize: 18, lineHeight: 26 },
  bodyLg: { fontFamily: fontFamilies.regular, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fontFamilies.regular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 },
  labelSm: { fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 18 },
  badge: { fontFamily: fontFamilies.bold, fontSize: 12, lineHeight: 16 },
  money: { fontFamily: fontFamilies.bold, fontSize: 18, lineHeight: 26, fontVariant: tabular },
  moneyLg: { fontFamily: fontFamilies.extrabold, fontSize: 28, lineHeight: 36, fontVariant: tabular },
  code: { fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 22, fontVariant: tabular },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof typography;

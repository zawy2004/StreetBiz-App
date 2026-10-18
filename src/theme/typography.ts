import { ArchivoNarrow_700Bold } from '@expo-google-fonts/archivo-narrow';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
  BeVietnamPro_800ExtraBold,
} from '@expo-google-fonts/be-vietnam-pro';
import { useFonts } from 'expo-font';
import type { TextStyle } from 'react-native';

/**
 * One family carries the app: Be Vietnam Pro (drawn for Vietnamese, the web's interface face),
 * with hierarchy from weight and size, like a native app. Archivo Narrow is kept only for
 * slot codes and figures, the web's street-sign face (React Native cannot set its width axis).
 */
export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  heavy: 'BeVietnamPro_800ExtraBold',
  code: 'ArchivoNarrow_700Bold',
} as const;

export function useAppFonts() {
  const [loaded, error] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
    BeVietnamPro_800ExtraBold,
    ArchivoNarrow_700Bold,
  });
  // A font that fails to load falls back to the system face; the layout must still hold.
  return loaded || error != null;
}

/**
 * The iOS text-style ramp (Large Title … Caption) set in Be Vietnam Pro. Its wide letters
 * read larger than SF at the same size, so body and callout sit 1pt under Apple's values.
 */
export const text = {
  largeTitle: { fontFamily: fonts.heavy, fontSize: 32, lineHeight: 40 },
  title1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34 },
  title2: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 28 },
  title3: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25 },
  headline: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  subhead: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 },
  footnote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

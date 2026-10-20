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
 * Type ramp v5 ("Biển hiệu phố", master prompt v5 §4.2). Be Vietnam Pro carries every word;
 * weight makes the hierarchy (800 for titles, 700 for headlines). Archivo Narrow is the street-
 * sign face: the one display line of a screen (signboard), slot plates, prices and big figures.
 */
export const text = {
  largeTitle: { fontFamily: fonts.heavy, fontSize: 32, lineHeight: 38, letterSpacing: -0.4 },
  title1: { fontFamily: fonts.heavy, fontSize: 27, lineHeight: 33, letterSpacing: -0.3 },
  title2: { fontFamily: fonts.heavy, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  title3: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25 },
  headline: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  callout: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  subhead: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19 },
  footnote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

/** Street-sign lettering (Archivo Narrow 700). One `display` per screen at most. */
// Line heights leave room above capitals for Vietnamese stacked marks (Ắ, Ấ, Ổ, Ở): a tighter
// box clips the upper mark on Android.
export const sign = {
  display: { fontFamily: fonts.code, fontSize: 54, lineHeight: 64, letterSpacing: -0.6 },
  title: { fontFamily: fonts.code, fontSize: 34, lineHeight: 42, letterSpacing: -0.3 },
  figure: { fontFamily: fonts.code, fontSize: 40, lineHeight: 50 },
  price: { fontFamily: fonts.code, fontSize: 18, lineHeight: 22 },
  plate: { fontFamily: fonts.code, fontSize: 15, lineHeight: 18, letterSpacing: 1 },
} satisfies Record<string, TextStyle>;

export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

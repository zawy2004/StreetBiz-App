import { SymbolView, type SymbolWeight } from 'expo-symbols';
import { useWindowDimensions, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  /** SF Symbol (iOS). */
  sf: string;
  /** Material Symbol (Android, web). */
  md: string;
  size?: number;
  color: ColorValue;
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
};

/**
 * The platform's own icon set: SF Symbols on iPhone, Material Symbols on Android — what native
 * apps use, sized with the text beside them. Decorative by default (the text says it).
 */
export function Icon({ sf, md, size = 20, color, weight = 'semibold', style }: Props) {
  // Android draws Material Symbols as a text glyph, which the system font size enlarges inside
  // the icon's fixed box (at 200% it was cut in half). Undo that scale so the glyph fits its box.
  const { fontScale } = useWindowDimensions();
  const glyph = process.env.EXPO_OS === 'android' ? size / fontScale : size;
  return (
    <SymbolView
      name={{ ios: sf as never, android: md as never, web: md as never }}
      size={glyph}
      tintColor={color}
      weight={weight}
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

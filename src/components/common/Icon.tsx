import { SymbolView, type SymbolWeight } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

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
  return (
    <SymbolView
      name={{ ios: sf as never, android: md as never, web: md as never }}
      size={size}
      tintColor={color}
      weight={weight}
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

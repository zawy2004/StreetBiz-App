import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { brandGlow } from '@/theme';

type Props = {
  /** Where the glow is centred, as fractions of the box. */
  cx?: number;
  cy?: number;
  /** Radius as a fraction of the larger side. */
  r?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

/** Soft brand-coloured light behind hero content (the FE landing page's street-lamp glow). */
export function Glow({ cx = 0.1, cy = 0, r = 0.9, color = brandGlow.from, opacity = 0.45, style }: Props) {
  const id = `glow-${useId().replace(/:/g, '')}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx={`${cx * 100}%`} cy={`${cy * 100}%`} r={`${r * 100}%`} fx={`${cx * 100}%`} fy={`${cy * 100}%`}>
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

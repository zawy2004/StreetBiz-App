import type { ReactNode } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KerbStrip } from '@/components/common/KerbStrip';
import { colors, fonts, sign } from '@/theme';

/**
 * The signature of v5 ("Biển hiệu phố"): a hand-painted shop sign across the top of a role's
 * home screen. Solid street orange running under the status bar, the screen's one display line
 * in condensed sign lettering (white over ink, like painted shop signs), a short line under it,
 * and the painted kerb as its lower edge. Whatever overlaps the edge (a search pill, a figure
 * card) goes in `overlap` and sits half on the sign, half on the pavement.
 *
 * Used once per screen, on the screens people land on (buyer Explore, vendor Today, ward Today).
 */
export function Signboard({
  top,
  line1,
  line2,
  caption,
  children,
  overlap,
  compact,
  color = colors.brand,
  line2Color = colors.plate,
  kerb = true,
  style,
}: {
  /** The row above the lettering: location, cart, bell. */
  top?: ReactNode;
  /** First painted line, white. Short (≤ 12 letters reads best). */
  line1: string;
  /** Second painted line, in ink. */
  line2?: string;
  /** One sentence under the lettering. */
  caption?: string;
  /** Extra content inside the sign (figures, chips). */
  children?: ReactNode;
  /** Sits across the sign's lower edge (search pill, summary card). */
  overlap?: ReactNode;
  /** A shorter sign for screens below a header. */
  compact?: boolean;
  /** The sign's paint: street orange; a verdict (leaf green, danger red) on the patrol's result. */
  color?: string;
  /** Colour of the second painted line (ink on orange; white on a dark verdict). */
  line2Color?: string;
  /** The painted kerb under the sign (orange signs only). */
  kerb?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={style}>
      <View
        style={{
          backgroundColor: color,
          paddingTop: compact ? 16 : insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: overlap ? 46 : 22,
        }}
      >
        {top}
        <View accessible accessibilityRole="header" accessibilityLabel={[line1, line2].filter(Boolean).join(' ')} style={{ marginTop: top ? 14 : 0 }}>
          <Text
            maxFontSizeMultiplier={1.3}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[compact ? sign.title : sign.display, { color: colors.white }]}
          >
            {line1.toLocaleUpperCase('vi-VN')}
          </Text>
          {line2 ? (
            <Text
              maxFontSizeMultiplier={1.3}
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[compact ? sign.title : sign.display, { color: line2Color, marginTop: -6 }]}
            >
              {line2.toLocaleUpperCase('vi-VN')}
            </Text>
          ) : null}
        </View>
        {caption ? (
          <Text style={{ marginTop: 10, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.white }}>{caption}</Text>
        ) : null}
        {children}
      </View>
      {kerb ? <KerbStrip height={10} segment={24} /> : null}
      {overlap ? <View style={{ marginTop: -38, paddingHorizontal: 20 }}>{overlap}</View> : null}
    </View>
  );
}

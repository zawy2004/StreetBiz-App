import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

const mark = require('@/assets/images/brand/streetbiz-mark.png') as number;

type Props = {
  size?: number;
  /** Sits the mark on a white tile, for dark hero surfaces. */
  plate?: boolean;
  /** Adds the "StreetBiz" wordmark beside the symbol. */
  wordmark?: boolean;
  onHero?: boolean;
};

/**
 * StreetBiz mark (same artwork as StreetBiz-FE's BrandLogo): a ring of
 * sidewalk-slot squares around a market-stall dot. Fixed brand colours.
 */
export function BrandMark({ size = 32, plate, wordmark, onHero }: Props) {
  const { colors } = useTheme();
  const symbol = <Image source={mark} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />;

  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="StreetBiz">
      {plate ? (
        <View style={[styles.plate, { padding: size * 0.16, borderRadius: size * 0.34, backgroundColor: '#FFFFFF' }]}>{symbol}</View>
      ) : (
        symbol
      )}
      {wordmark ? (
        <AppText variant="title" style={{ color: onHero ? colors.onHero : colors.text }}>
          StreetBiz
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plate: { alignItems: 'center', justifyContent: 'center' },
});

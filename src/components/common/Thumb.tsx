import { Image, StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

type Props = { uri?: string; size?: number; icon?: IconName; rounded?: boolean };

/** Photo when we have one, otherwise a neutral tile with an icon (the mock data has no images). */
export function Thumb({ uri, size = 64, icon = 'food', rounded }: Props) {
  const { colors } = useTheme();
  const shape = { width: size, height: size, borderRadius: rounded ? size / 2 : radius.card };
  if (uri) return <Image source={{ uri }} style={shape} />;
  return (
    <View style={[styles.tile, shape, { backgroundColor: colors.secondaryBg }]}>
      <Icon name={icon} size={Math.round(size * 0.45)} color="onSecondary" />
    </View>
  );
}

const styles = StyleSheet.create({ tile: { alignItems: 'center', justifyContent: 'center' } });

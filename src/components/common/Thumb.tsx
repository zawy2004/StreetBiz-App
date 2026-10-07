import { Image, StyleSheet, View } from 'react-native';

import { accentTone, radius, useTheme, type AccentTone } from '@/theme';

import { Icon, type IconName } from './Icon';

type Props = {
  uri?: string;
  size?: number;
  icon?: IconName;
  rounded?: boolean;
  /** Any stable id; picks the tile colour so neighbouring shops do not all look alike. */
  seed?: string;
};

const TONES: AccentTone[] = ['secondary', 'primary', 'tertiary', 'indigo'];

function toneFor(seed?: string): AccentTone {
  if (!seed) return 'secondary';
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length] ?? 'secondary';
}

/** Photo when we have one, otherwise a tinted tile with an icon (the mock data has no images). */
export function Thumb({ uri, size = 64, icon = 'food', rounded, seed }: Props) {
  const { colors } = useTheme();
  const shape = { width: size, height: size, borderRadius: rounded ? size / 2 : Math.min(radius.card, size * 0.28) };
  if (uri) return <Image source={{ uri }} style={shape} />;
  const tone = accentTone(colors, toneFor(seed));
  return (
    <View style={[styles.tile, shape, { backgroundColor: tone.bg }]}>
      <Icon name={icon} size={Math.round(size * 0.44)} color={tone.fg} />
    </View>
  );
}

const styles = StyleSheet.create({ tile: { alignItems: 'center', justifyContent: 'center' } });

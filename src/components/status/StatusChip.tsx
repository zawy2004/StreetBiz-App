import { StyleSheet, View } from 'react-native';

import { statusLabel } from '@/core/constants/status-labels';
import { radius, useTheme, type StatusTone } from '@/theme';

import { AppText } from '../common/AppText';

type Props = { code: string; label?: never; tone?: never } | { label: string; tone: StatusTone; code?: never };

export function StatusChip(props: Props) {
  const { tones } = useTheme();
  const resolved = props.code !== undefined ? statusLabel(props.code) : { label: props.label, tone: props.tone };
  const tone = tones[resolved.tone];
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]} accessibilityLabel={resolved.label}>
      <View style={[styles.dot, { backgroundColor: tone.dot }]} />
      <AppText variant="badge" style={{ color: tone.fg }}>{resolved.label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.chip,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

import { Pressable, StyleSheet, View } from 'react-native';

import { accentTone, radius, spacing, useTheme, type AccentTone } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Props = {
  icon: IconName;
  value: string;
  label: string;
  tone?: AccentTone;
  onPress?: () => void;
};

/** Small metric tile for dashboards (count + label), laid out three across. */
export function StatTile({ icon, value, label, tone = 'indigo', onPress }: Props) {
  const { colors, shadow } = useTheme();
  const t = accentTone(colors, tone);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        shadow.card,
        { backgroundColor: pressed ? colors.sunken : colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: t.bg }]}>
        <Icon name={icon} size={18} color={t.fg} />
      </View>
      <AppText variant="title" numberOfLines={1}>{value}</AppText>
      <AppText variant="caption" color="muted" numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 0, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth * 2, padding: spacing.md, gap: 6 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});

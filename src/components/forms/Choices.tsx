import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';

type ChoiceProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
};

/** Large selectable card (e.g. role or business type). */
export function ChoiceCard({ title, subtitle, icon, selected, onPress }: ChoiceProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: selected ? colors.primarySoft : colors.card, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1 },
      ]}
    >
      {icon ? (
        <View style={[styles.iconTile, { backgroundColor: selected ? colors.card : colors.indigoSoft }]}>
          <Icon name={icon} size={24} color={selected ? 'primary' : 'indigo'} />
        </View>
      ) : null}
      <View style={styles.body}>
        <AppText variant="headline">{title}</AppText>
        {subtitle ? <AppText variant="small" color="muted">{subtitle}</AppText> : null}
      </View>
      {selected ? <Icon name="check-circle" size={24} color="primary" /> : null}
    </Pressable>
  );
}

/** Compact radio row for short option lists. */
export function RadioRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.radio, { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border }]}
    >
      <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={selected ? 'primary' : 'muted'} />
      <AppText variant="label" style={styles.body}>{label}</AppText>
    </Pressable>
  );
}

export function CheckRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onToggle} style={styles.check}>
      <Icon name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={checked ? 'primary' : 'muted'} />
      <AppText style={styles.body}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.card },
  body: { flex: 1, gap: 2 },
  iconTile: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  radio: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.control, borderWidth: 1.5 },
  check: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

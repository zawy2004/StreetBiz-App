import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { layout, radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';

type Props = {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
};

export function FilterChips({ options, selected, onToggle }: Props) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onToggle(o.value)}
            style={[
              styles.chip,
              on
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <AppText variant="label" color={on ? 'onPrimary' : 'text'}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -layout.screenMargin },
  row: { gap: spacing.sm, paddingHorizontal: layout.screenMargin },
  chip: { minHeight: 40, paddingHorizontal: spacing.lg, borderRadius: radius.full, borderWidth: 1, justifyContent: 'center' },
});

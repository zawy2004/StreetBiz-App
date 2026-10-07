import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { layout, radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';

type Props = {
  options: { value: string; label: string; icon?: IconName }[];
  selected: string[];
  onToggle: (value: string) => void;
};

/** Horizontally scrolling toggle chips; a selected chip inverts to the text colour. */
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
                ? { backgroundColor: colors.indigo, borderColor: colors.indigo }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {o.icon ? <Icon name={o.icon} size={16} color={on ? 'onIndigo' : 'muted'} /> : null}
            <AppText variant="labelSm" color={on ? 'onIndigo' : 'text'}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -layout.screenMargin, flexGrow: 0 },
  row: { gap: spacing.sm, paddingHorizontal: layout.screenMargin },
  chip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});

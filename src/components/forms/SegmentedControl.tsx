import { Pressable, StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';

type Option<T extends string> = { value: T; label: string; icon?: IconName };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors, shadow } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.sunken }]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.item, selected ? [shadow.card, { backgroundColor: colors.card }] : null]}
          >
            {o.icon ? <Icon name={o.icon} size={18} color={selected ? 'primary' : 'muted'} /> : null}
            <AppText variant="labelSm" color={selected ? 'text' : 'muted'} numberOfLines={1}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.full, padding: 4 },
  item: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: radius.full,
  },
});

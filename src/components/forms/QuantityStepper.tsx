import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';

type Props = { value: number; onChange: (value: number) => void; min?: number };

export function QuantityStepper({ value, onChange, min = 0 }: Props) {
  const { colors } = useTheme();
  const button = (icon: 'minus' | 'plus', label: string, next: number, disabled?: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={[styles.btn, { borderColor: colors.borderStrong, opacity: disabled ? 0.4 : 1 }]}
      hitSlop={4}
    >
      <Icon name={icon} size={20} color="indigo" />
    </Pressable>
  );
  return (
    <View style={styles.row}>
      {button('minus', 'Giảm', value - 1, value <= min)}
      <AppText variant="label" style={styles.value}>{value}</AppText>
      {button('plus', 'Tăng', value + 1)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: { width: 40, height: 40, borderRadius: radius.control, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 28, textAlign: 'center' },
});

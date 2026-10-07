import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { layout, radius, spacing, typography, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'civic' | 'outline' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'sm';
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  fullWidth = true,
  size = 'md',
  testID,
}: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const look = {
    primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary, border: colors.primary },
    civic: { bg: colors.indigo, pressed: colors.indigo, fg: colors.onIndigo, border: colors.indigo },
    outline: { bg: colors.card, pressed: colors.sunken, fg: colors.indigo, border: colors.indigo },
    ghost: { bg: 'transparent', pressed: colors.sunken, fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.card, pressed: colors.errorBg, fg: colors.error, border: colors.error },
  }[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'md' ? layout.touch : 40,
          paddingHorizontal: size === 'md' ? spacing.lg : spacing.md,
          backgroundColor: pressed ? look.pressed : look.bg,
          borderColor: look.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={20} color={look.fg} /> : null}
          <Text style={[typography.label, { color: look.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.control,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

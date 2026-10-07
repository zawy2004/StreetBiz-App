import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

/**
 * `glass` and `light` are for dark hero surfaces (HeroCard, the welcome
 * screen): a translucent outline and a solid white button respectively.
 */
export type ButtonVariant = 'primary' | 'civic' | 'outline' | 'soft' | 'ghost' | 'danger' | 'glass' | 'light';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'lg' | 'md' | 'sm';
  testID?: string;
};

const HEIGHT = { lg: 56, md: 50, sm: 40 } as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
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
    outline: { bg: colors.card, pressed: colors.sunken, fg: colors.text, border: colors.borderStrong },
    soft: { bg: colors.primarySoft, pressed: colors.primarySoft, fg: colors.primary, border: colors.primarySoft },
    ghost: { bg: 'transparent', pressed: colors.sunken, fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.card, pressed: colors.errorBg, fg: colors.error, border: colors.error },
    glass: { bg: 'rgba(255,255,255,0.08)', pressed: 'rgba(255,255,255,0.16)', fg: colors.onHero, border: colors.heroLine },
    light: { bg: '#FFFFFF', pressed: '#F1EFEA', fg: '#14171C', border: '#FFFFFF' },
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
          minHeight: HEIGHT[size],
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
          borderRadius: size === 'sm' ? radius.control - 2 : radius.control + 2,
          backgroundColor: pressed ? look.pressed : look.bg,
          borderColor: look.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed && !inactive ? 0.985 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 18 : 20} color={look.fg} /> : null}
          <Text style={[size === 'sm' ? typography.labelSm : typography.label, { color: look.fg }]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 18 : 20} color={look.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

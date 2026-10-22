import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, shadow } from '@/theme';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'sign' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  /** 50 for most buttons, 56 for the one action a screen exists for. */
  size?: 50 | 56;
  icon?: { sf: string; md: string };
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * Look v5 ("Biển hiệu phố"): the primary is a solid orange capsule with an orange glow (the
 * one bright thing in thumb reach); secondary is orange-tinted paper with orange words, never
 * a grey outline; `sign` is the civic blue for ward actions; `danger` only confirms a refusal.
 */
const look: Record<Variant, { bg: string; fg: string; border?: string; shadow?: string }> = {
  primary: { bg: colors.cta, fg: colors.white, shadow: shadow.glow },
  secondary: { bg: colors.brandTint, fg: colors.primary },
  sign: { bg: colors.sign, fg: colors.white, shadow: '0 12px 26px -12px rgba(10, 95, 168, 0.55)' },
  /** The confirming button of a destructive decision (refuse, revoke), never a screen's everyday action. */
  danger: { bg: colors.danger, fg: colors.white, shadow: '0 12px 26px -12px rgba(180, 35, 24, 0.5)' },
};

/** A capsule button: one primary per screen, a light haptic when it commits. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 50,
  icon,
  loading,
  disabled,
  style,
  accessibilityHint,
}: Props) {
  const v = look[variant];
  const press = () => {
    if (loading || disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };
  return (
    <PressableScale
      onPress={press}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[
        {
          // Grows with large text (200%) instead of cutting a wrapped label in half.
          minHeight: size,
          paddingVertical: 8,
          borderRadius: size / 2,
          borderCurve: 'continuous',
          backgroundColor: v.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          opacity: disabled ? 0.45 : 1,
          boxShadow: disabled ? undefined : v.shadow,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : icon ? (
          <Icon sf={icon.sf} md={icon.md} size={size === 56 ? 20 : 18} color={v.fg} />
        ) : null}
        <Text style={{ flexShrink: 1, textAlign: 'center', fontFamily: fonts.heavy, fontSize: size === 56 ? 17 : 15.5, letterSpacing: 0.1, color: v.fg }}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

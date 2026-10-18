import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, shadow } from '@/theme';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'sign';

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

const look: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.cta, fg: colors.white },
  secondary: { bg: colors.card, fg: colors.ink, border: colors.line },
  sign: { bg: colors.sign, fg: colors.white },
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
          height: size,
          borderRadius: size / 2,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 22,
          opacity: disabled ? 0.45 : 1,
          boxShadow: variant === 'secondary' ? undefined : shadow.card,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : icon ? (
          <Icon sf={icon.sf} md={icon.md} size={size === 56 ? 20 : 18} color={v.fg} />
        ) : null}
        <Text style={{ fontFamily: fonts.bold, fontSize: size === 56 ? 17 : 15.5, color: v.fg }}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

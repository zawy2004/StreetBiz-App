import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors, fonts, radius, statusTones, text } from '@/theme';

export type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'brand';

const look: Record<BannerTone, { wash: string; ink: string; icon: { sf: string; md: string } }> = {
  info: { wash: colors.signTint, ink: colors.sign, icon: { sf: 'info.circle.fill', md: 'info' } },
  success: {
    wash: statusTones.ok.wash,
    ink: statusTones.ok.ink,
    icon: { sf: 'checkmark.circle.fill', md: 'check_circle' },
  },
  warning: {
    wash: statusTones.pending.wash,
    ink: statusTones.pending.ink,
    icon: { sf: 'exclamationmark.triangle.fill', md: 'warning' },
  },
  danger: {
    wash: statusTones.danger.wash,
    ink: statusTones.danger.ink,
    icon: { sf: 'xmark.octagon.fill', md: 'error' },
  },
  neutral: {
    wash: colors.sunken,
    ink: '#2B3640',
    icon: { sf: 'info.circle.fill', md: 'info' },
  },
  brand: { wash: colors.brandTint, ink: colors.primary, icon: { sf: 'sparkles', md: 'auto_awesome' } },
};

/**
 * An inline notice inside a screen: a soft wash of the tone, a glyph, words that say what
 * happened and, when there is one, the action that fixes it.
 */
export function Banner({
  tone = 'info',
  title,
  children,
  icon,
  action,
  style,
}: {
  tone?: BannerTone;
  title?: string;
  children?: ReactNode;
  icon?: { sf: string; md: string };
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const t = look[tone];
  const glyph = icon ?? t.icon;
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      style={[
        {
          flexDirection: 'row',
          gap: 10,
          padding: 14,
          borderRadius: radius.control + 2,
          borderCurve: 'continuous',
          backgroundColor: t.wash,
        },
        style,
      ]}
    >
      <Icon sf={glyph.sf} md={glyph.md} size={18} color={t.ink} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 3 }}>
        {title ? (
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: t.ink }}>
            {title}
          </Text>
        ) : null}
        {/* Plain words, even mixed with values ("Giỏ có {n} món"), go inside one Text: a bare string in a
            View crashes on native. Only children that are elements are laid out as they are. */}
        {Children.count(children) > 0 && !Children.toArray(children).some(isValidElement) ? (
          <Text style={[text.subhead, { fontFamily: fonts.regular, color: t.ink }]}>{children}</Text>
        ) : (
          children
        )}
        {action ? (
          <Pressable
            onPress={action.onPress}
            hitSlop={8}
            accessibilityRole="button"
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: t.ink }}>
              {action.label} ›
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

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
          gap: 12,
          padding: 14,
          borderRadius: radius.photo,
          borderCurve: 'continuous',
          backgroundColor: t.wash,
        },
        style,
      ]}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={glyph.sf} md={glyph.md} size={18} color={t.ink} />
      </View>
      <View style={{ flex: 1, gap: 3, paddingTop: title ? 6 : 7 }}>
        {title ? (
          <Text style={{ fontFamily: fonts.heavy, fontSize: 15.5, lineHeight: 21, color: t.ink }}>
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
            style={{ alignSelf: 'flex-start', marginTop: 6, minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.white }}
          >
            <Text style={{ fontFamily: fonts.heavy, fontSize: 14, color: t.ink }}>{action.label}</Text>
            <Icon sf="chevron.right" md="chevron_right" size={13} color={t.ink} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

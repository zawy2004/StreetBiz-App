import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { selectableText } from '@/utils/platform';
import { Icon } from './Icon';

/** A white rounded surface: the one card of the app (radius 22, continuous, resting shadow). */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          padding: padded ? 16 : 0,
          overflow: 'hidden',
          boxShadow: shadow.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A section title with an optional note under it and an action on the right. */
export function SectionHeader({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 20, lineHeight: 26, letterSpacing: -0.2, color: colors.ink }}>
          {title}
        </Text>
        {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.primary }}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export type KeyValue = { label: string; value: ReactNode; mono?: boolean; emphasis?: boolean };

/** Detail rows: label on the left, value on the right (wraps under on long values). */
export function KeyValueList({ rows }: { rows: (KeyValue | null | false | undefined)[] }) {
  const items = rows.filter(Boolean) as KeyValue[];
  return (
    <View>
      {items.map((r, i) => (
        <View
          key={`${r.label}-${i}`}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            paddingVertical: 11,
            borderBottomWidth: i < items.length - 1 ? 1 : 0,
            borderBottomColor: colors.separator,
          }}
        >
          <Text style={[text.subhead, { fontFamily: fonts.regular, color: colors.muted, width: '40%' }]}>{r.label}</Text>
          {typeof r.value === 'string' || typeof r.value === 'number' ? (
            <Text
              selectable={selectableText}
              style={[
                text.subhead,
                {
                  flex: 1,
                  textAlign: 'right',
                  color: colors.ink,
                  fontFamily: r.emphasis ? fonts.bold : r.mono ? fonts.code : fonts.semibold,
                  fontSize: r.mono ? 15 : 14,
                },
                tabular,
              ]}
            >
              {r.value}
            </Text>
          ) : (
            <View style={{ flex: 1, alignItems: 'flex-end' }}>{r.value}</View>
          )}
        </View>
      ))}
    </View>
  );
}

/** A 44 pt round header button with an optional count badge (bell, chat). v5: white disc, soft lift. */
export function HeaderIconButton({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: { sf: string; md: string };
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} chưa đọc` : label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: pressed ? colors.brandTint : colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px -6px rgba(17, 28, 43, 0.28)',
      })}
    >
      <Icon sf={icon.sf} md={icon.md} size={20} color={colors.ink} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            paddingHorizontal: 5,
            backgroundColor: colors.cta,
            borderWidth: 2,
            borderColor: colors.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[{ fontFamily: fonts.heavy, fontSize: 11, color: colors.white }, tabular]}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** A big figure with a caption: counts and money on dashboards. */
export function StatTile({
  value,
  label,
  tone = 'ink',
  icon,
  onPress,
}: {
  value: string;
  label: string;
  tone?: 'ink' | 'brand' | 'ok' | 'warn' | 'danger' | 'sign';
  icon?: { sf: string; md: string };
  onPress?: () => void;
}) {
  const ink = {
    ink: colors.ink,
    brand: colors.primary,
    ok: colors.onLeaf,
    warn: colors.onMango,
    danger: colors.onDanger,
    sign: colors.sign,
  }[tone];
  const wash = {
    ink: colors.sunken,
    brand: colors.brandTint,
    ok: colors.leafTint,
    warn: colors.mangoTint,
    danger: colors.dangerTint,
    sign: colors.signTint,
  }[tone];
  // v5: the figure in sign lettering, coloured by its tone; the icon on a round wash.
  const body = (
    <View style={{ flex: 1, padding: 16, gap: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
      {icon ? (
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: wash, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf={icon.sf} md={icon.md} size={18} color={ink} />
        </View>
      ) : null}
      <Text maxFontSizeMultiplier={1.3} style={[sign.title, { color: ink }, tabular]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.muted }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
  );
}

/**
 * A segmented filter (tabs inside a screen). v5: a sunken capsule track; the chosen segment is a
 * solid orange capsule with white words, its count on a white disc.
 */
export function Segments<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string; count?: number }[];
  onChange: (key: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.sunken, borderRadius: 999, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
              paddingHorizontal: 8,
              backgroundColor: on ? colors.cta : 'transparent',
              boxShadow: on ? '0 6px 14px -8px rgba(238, 85, 0, 0.7)' : undefined,
            }}
          >
            <Text numberOfLines={1} style={{ fontFamily: on ? fonts.heavy : fonts.semibold, fontSize: 13.5, color: on ? colors.white : colors.muted }}>
              {o.label}
            </Text>
            {o.count != null && o.count > 0 ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: on ? colors.white : colors.line, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[{ fontFamily: fonts.heavy, fontSize: 11, color: on ? colors.primary : colors.ink }, tabular]}>{o.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

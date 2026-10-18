import type { ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, tabular, text } from '@/theme';
import { selectableText } from '@/utils/platform';
import { Icon } from './Icon';

/** A white rounded surface: the one card of the app (radius 20, continuous corners). */
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
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>
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

/** A 44 pt round header button with an optional count badge (bell, chat). */
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
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: pressed ? colors.sunken : colors.card,
        borderWidth: 1,
        borderColor: colors.line,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Icon sf={icon.sf} md={icon.md} size={19} color={colors.ink} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            paddingHorizontal: 5,
            backgroundColor: colors.cta,
            borderWidth: 2,
            borderColor: colors.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[{ fontFamily: fonts.bold, fontSize: 11, color: colors.white }, tabular]}>
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
  const body = (
    <View style={{ flex: 1, padding: 14, gap: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
      {icon ? (
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: wash, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf={icon.sf} md={icon.md} size={16} color={ink} />
        </View>
      ) : null}
      <Text style={[{ fontFamily: fonts.heavy, fontSize: 24, lineHeight: 30, color: ink }, tabular]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[text.footnote, { color: colors.muted }]} numberOfLines={2}>
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

/** A soft segmented filter (tabs inside a screen), scrolling sideways when long. */
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
    <View style={{ flexDirection: 'row', backgroundColor: colors.sunken, borderRadius: 14, padding: 4, gap: 4 }}>
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
              minHeight: 38,
              borderRadius: 11,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 5,
              paddingHorizontal: 6,
              backgroundColor: on ? colors.card : 'transparent',
              boxShadow: on ? '0 2px 6px -2px rgba(17, 28, 43, 0.18)' : undefined,
            }}
          >
            <Text numberOfLines={1} style={{ fontFamily: on ? fonts.bold : fonts.medium, fontSize: 13.5, color: on ? colors.ink : colors.muted }}>
              {o.label}
            </Text>
            {o.count != null && o.count > 0 ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: on ? colors.cta : colors.line, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[{ fontFamily: fonts.bold, fontSize: 10.5, color: on ? colors.white : colors.ink }, tabular]}>{o.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, fonts, radius, text } from '@/theme';
import { Icon } from './Icon';

type IconSpec = { sf: string; md: string };

/**
 * An inset-grouped section (settings, detail panels, short menus): an optional small
 * heading, white rows on a rounded card, hairlines between rows, an optional footnote.
 */
export function ListGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 13,
            color: colors.muted,
            marginLeft: 4,
          }}
        >
          {title}
        </Text>
      ) : null}
      <View
        style={{
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: colors.card,
          overflow: 'hidden',
        }}
      >
        {rows.map((row, i) => (
          <View key={row.key ?? i}>
            {row}
            {i < rows.length - 1 ? (
              <View
                style={{
                  position: 'absolute',
                  left: 60,
                  right: 0,
                  bottom: 0,
                  height: 1,
                  backgroundColor: colors.separator,
                }}
              />
            ) : null}
          </View>
        ))}
      </View>
      {footer ? (
        <Text style={[text.footnote, { color: colors.muted, marginHorizontal: 4 }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

/**
 * One row: an icon tile, a title with an optional second line, a value or accessory on the
 * right, and a chevron when it opens more. Highlights under the finger (rows never scale).
 */
export function ListRow({
  title,
  subtitle,
  value,
  icon,
  tint = colors.primary,
  tileColor = colors.brandTint,
  onPress,
  onLongPress,
  destructive,
  accessory,
  chevron = !!onPress,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconSpec;
  tint?: string;
  tileColor?: string;
  onPress?: () => void;
  /** Long press, e.g. to open the row's `ActionMenu`. */
  onLongPress?: () => void;
  destructive?: boolean;
  accessory?: ReactNode;
  chevron?: boolean;
  disabled?: boolean;
}) {
  const ink = destructive ? colors.onDanger : colors.ink;
  const content = (pressed: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingLeft: 14,
        paddingRight: 14,
        paddingVertical: 10,
        backgroundColor: pressed ? colors.pressed : colors.card,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            borderCurve: 'continuous',
            backgroundColor: destructive ? colors.dangerTint : tileColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sf={icon.sf} md={icon.md} size={17} color={destructive ? colors.danger : tint} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[text.body, { color: ink, fontFamily: fonts.medium }]}>{title}</Text>
        {subtitle ? (
          <Text style={[text.footnote, { color: colors.muted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[text.callout, { color: colors.muted, maxWidth: '45%' }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {accessory}
      {chevron ? (
        <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
      ) : null}
    </View>
  );
  if (!onPress) return content(false);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
    >
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

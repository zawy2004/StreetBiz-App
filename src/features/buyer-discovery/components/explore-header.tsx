import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { RoundButton } from '@/ui';
import { colors, fonts, shadow, space } from '@/theme';

/**
 * Where the buyer is browsing — the first thing every food app shows, and the way to change it.
 * v5: white words on the orange signboard (or ink on the compact bar's white).
 */
export function LocationButton({
  wardName,
  onPress,
  onSign = true,
}: {
  wardName: string;
  onPress: () => void;
  onSign?: boolean;
}) {
  const ink = onSign ? colors.white : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Khu vực ${wardName}, đổi khu vực`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, flexShrink: 1 }}
    >
      <Icon sf="location.fill" md="near_me" size={18} color={onSign ? colors.white : colors.cta} />
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15, color: onSign ? 'rgba(255,255,255,0.86)' : colors.muted }}>
          Lấy món tại
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.heavy, fontSize: 16.5, lineHeight: 21, color: ink }}>
            {wardName}
          </Text>
          <Icon sf="chevron.down" md="expand_more" size={14} color={ink} weight="bold" />
        </View>
      </View>
    </Pressable>
  );
}

/** Cart in the header, with the dish count on a badge (v5 round button). */
export function CartButton({ count, onPress, onSign = true }: { count: number; onPress: () => void; onSign?: boolean }) {
  return (
    <RoundButton
      icon={{ sf: 'bag.fill', md: 'shopping_bag' }}
      label={count ? 'Giỏ hàng, số món' : 'Giỏ hàng trống'}
      badge={count || undefined}
      tone={onSign ? 'onSign' : 'plain'}
      onPress={onPress}
    />
  );
}

/** The way in for most buyers, so it is always on screen instead of hiding behind an icon. */
export function SearchField({
  value,
  onChange,
  focused,
  onFocus,
  onBlur,
  onSubmit,
}: {
  value: string;
  onChange: (text: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: () => void;
}) {
  return (
    // v5: a white capsule laid across the signboard's lower edge; orange rim while typing.
    <View
      style={{
        minHeight: 56,
        borderRadius: 28,
        backgroundColor: colors.white,
        borderWidth: 2,
        borderColor: focused ? colors.cta : colors.white,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 18,
        paddingRight: 8,
        gap: 10,
        boxShadow: shadow.raised,
      }}
    >
      <Icon sf="magnifyingglass" md="search" size={20} color={colors.primary} weight="semibold" />
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmit}
        placeholder="Bún chả, bánh mì, tên đường…"
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCorrect={false}
        maxFontSizeMultiplier={1.4}
        selectionColor={colors.cta}
        cursorColor={colors.cta}
        accessibilityLabel="Tìm món, quán hoặc tên đường"
        style={{
          flex: 1,
          minHeight: 52,
          fontFamily: fonts.semibold,
          fontSize: 16,
          color: colors.ink,
          paddingVertical: 0,
        }}
      />
      {value ? (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Xoá tìm kiếm"
          style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon sf="xmark.circle.fill" md="cancel" size={19} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A tappable word under the search field. */
function SuggestChip({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: { sf: string; md: string };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Tìm ${label}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: pressed ? colors.brandTint : colors.card,
        borderWidth: 1.5,
        borderColor: colors.line,
      })}
    >
      <Icon sf={icon.sf} md={icon.md} size={13} color={colors.muted} />
      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * What to search for, shown while the field is focused and empty (Grab, ShopeeFood): this
 * session's recent searches, then dishes on sale now. One tap runs the search.
 */
export function SearchSuggestions({
  recent,
  popular,
  onPick,
  onClearRecent,
}: {
  recent: string[];
  popular: string[];
  onPick: (q: string) => void;
  onClearRecent: () => void;
}) {
  const group = (
    title: string,
    items: string[],
    icon: { sf: string; md: string },
    action?: ReactNode,
  ) =>
    items.length ? (
      <View style={{ gap: 10 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>{title}</Text>
          {action}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {items.map((q) => (
            <SuggestChip key={q} label={q} icon={icon} onPress={() => onPick(q)} />
          ))}
        </View>
      </View>
    ) : null;

  return (
    <View style={{ paddingHorizontal: space.md, gap: 18 }}>
      {group(
        'Tìm gần đây',
        recent,
        { sf: 'clock.arrow.circlepath', md: 'history' },
        <Pressable onPress={onClearRecent} hitSlop={10} accessibilityRole="button">
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>Xoá</Text>
        </Pressable>,
      )}
      {group('Gợi ý món đang bán', popular, { sf: 'fork.knife', md: 'restaurant' })}
    </View>
  );
}

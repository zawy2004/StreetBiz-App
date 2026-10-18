import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors, fonts, space, tabular } from '@/theme';

/** Where the buyer is browsing — the first thing every food app shows, and the way to change it. */
export function LocationButton({ wardName, onPress }: { wardName: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Khu vực ${wardName}, đổi khu vực`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.brandTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sf="location.fill" md="location_on" size={17} color={colors.cta} />
      </View>
      <View>
        <Text
          style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 15, color: colors.muted }}
        >
          Lấy món tại
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.ink }}>
            {wardName}
          </Text>
          <Icon sf="chevron.down" md="expand_more" size={13} color={colors.ink} weight="bold" />
        </View>
      </View>
    </Pressable>
  );
}

/** Cart in the header, with the dish count on an orange badge. */
export function CartButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={count ? `Giỏ hàng, ${count} món` : 'Giỏ hàng trống'}
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
      <Icon sf="bag.fill" md="shopping_bag" size={19} color={colors.ink} />
      {count > 0 ? (
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
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
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
    <View
      style={{
        marginHorizontal: space.md,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.card,
        borderWidth: 1.5,
        borderColor: focused ? colors.cta : colors.line,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 6,
        gap: 10,
        boxShadow: '0 4px 14px -8px rgba(17, 28, 43, 0.18)',
      }}
    >
      <Icon sf="magnifyingglass" md="search" size={19} color={colors.cta} weight="semibold" />
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmit}
        placeholder="Thèm gì? Tìm món, quán, tên đường"
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCorrect={false}
        selectionColor={colors.cta}
        cursorColor={colors.cta}
        accessibilityLabel="Tìm món, quán hoặc tên đường"
        style={{
          flex: 1,
          height: '100%',
          fontFamily: fonts.medium,
          fontSize: 15.5,
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
        height: 36,
        paddingHorizontal: 13,
        borderRadius: 18,
        backgroundColor: pressed ? colors.brandTint : colors.card,
        borderWidth: 1,
        borderColor: colors.line,
      })}
    >
      <Icon sf={icon.sf} md={icon.md} size={13} color={colors.muted} />
      <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.ink }}>
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
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.ink }}>{title}</Text>
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

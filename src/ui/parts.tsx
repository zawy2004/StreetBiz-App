import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/common/Icon';
import { colors, fonts, radius, shadow, sign, tabular } from '@/theme';

type IconSpec = { sf: string; md: string };

/**
 * v5 signature parts ("Biển hiệu phố"). Each is a real object from the street the app serves:
 * the price sticker on a stall's glass, the slot's number plate, the ticket the stall hands back.
 */

/** Mango paper price sticker, slightly askew like one stuck on by hand. Prices in Archivo. */
export function PriceSticker({ value, tilt = 4, style }: { value: string; tilt?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityLabel={`Giá ${value}`}
      style={[
        {
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.sticker,
          borderCurve: 'continuous',
          backgroundColor: colors.sticker,
          transform: [{ rotate: `${tilt}deg` }],
          boxShadow: '0 6px 12px -6px rgba(17, 28, 43, 0.45)',
        },
        style,
      ]}
    >
      <Text maxFontSizeMultiplier={1.4} style={[sign.price, { color: colors.plate }, tabular]}>{value}</Text>
    </View>
  );
}

/** The slot's street plate: ink, white Archivo letters, white rim. */
export function Plate({ code, prefix, style }: { code: string; prefix?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityLabel={prefix ? `${prefix} ${code}` : code}
      style={[
        {
          alignSelf: 'flex-start',
          paddingHorizontal: 9,
          minHeight: 28,
          justifyContent: 'center',
          borderRadius: radius.plate,
          backgroundColor: colors.plate,
          borderWidth: 2,
          borderColor: colors.white,
        },
        style,
      ]}
    >
      <Text maxFontSizeMultiplier={1.4} style={[sign.plate, { color: colors.white }]}>
        {prefix ? `${prefix} ` : ''}
        {code}
      </Text>
    </View>
  );
}

/** "Ảnh minh họa" on a stock photo, never on a vendor's own. */
export function IllustrativeTag() {
  return (
    <View style={{ position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(17, 28, 43, 0.55)' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: colors.white }}>Ảnh minh họa</Text>
    </View>
  );
}

/** A photo with the house radius, a neutral placeholder while loading, and the stock-photo tag. */
export function PhotoTile({
  source,
  illustrative,
  style,
  children,
  recyclingKey,
}: {
  source: ImageSourcePropType | string | null | undefined;
  illustrative?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  recyclingKey?: string;
}) {
  return (
    <View style={[{ borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.sunken }, style]}>
      {source ? (
        <Image source={source} recyclingKey={recyclingKey} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="fork.knife" md="restaurant" size={26} color={colors.muted} />
        </View>
      )}
      {illustrative ? <IllustrativeTag /> : null}
      {children}
    </View>
  );
}

/** Round photo badge for a category, ringed in orange tint (orange when chosen). */
export function PhotoCircle({ source, label, selected, onPress }: { source: ImageSourcePropType; label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={label} style={{ alignItems: 'center', gap: 8, width: 76 }}>
      <View style={{ width: 70, height: 70, borderRadius: 35, padding: 3, backgroundColor: selected ? colors.cta : colors.brandTint }}>
        <Image source={source} style={{ width: '100%', height: '100%', borderRadius: 32 }} contentFit="cover" />
      </View>
      <Text numberOfLines={2} style={{ fontFamily: selected ? fonts.heavy : fonts.bold, fontSize: 12.5, lineHeight: 16, color: selected ? colors.primary : colors.ink, textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Round 44 button for a signboard or a photo (location, cart, bell), with a count badge. */
export function RoundButton({ icon, label, onPress, badge, tone = 'onSign' }: { icon: IconSpec; label: string; onPress: () => void; badge?: number; tone?: 'onSign' | 'plain' }) {
  const onSign = tone === 'onSign';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: onSign ? (pressed ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.22)') : pressed ? colors.brandTint : colors.card,
        borderWidth: onSign ? 0 : 1.5,
        borderColor: colors.line,
      })}
    >
      <Icon sf={icon.sf} md={icon.md} size={20} color={onSign ? colors.white : colors.ink} />
      {badge ? (
        <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: onSign ? colors.plate : colors.cta, borderWidth: 2, borderColor: onSign ? colors.brand : colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[{ fontFamily: fonts.heavy, fontSize: 11, color: colors.white }, tabular]}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The white search capsule that sits across a signboard's edge. Tapping opens search. */
export function SearchPill({ placeholder, onPress, children }: { placeholder: string; onPress?: () => void; children?: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      style={{ minHeight: 56, borderRadius: 28, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, boxShadow: shadow.raised }}
    >
      <Icon sf="magnifyingglass" md="search" size={20} color={colors.primary} />
      {children ?? <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.muted }}>{placeholder}</Text>}
    </Pressable>
  );
}

/** A big figure with its label: money, counts, days. Archivo figures, Be Vietnam label. */
export function BigNumber({ value, label, tone = 'ink', onPress, style }: { value: string; label: string; tone?: 'ink' | 'brand' | 'onSign' | 'danger' | 'ok'; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const color = tone === 'brand' ? colors.primary : tone === 'onSign' ? colors.white : tone === 'danger' ? colors.onDanger : tone === 'ok' ? colors.onLeaf : colors.ink;
  const body = (
    <View style={[{ gap: 2 }, style]}>
      <Text maxFontSizeMultiplier={1.3} style={[sign.figure, { color }, tabular]}>{value}</Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18, color: tone === 'onSign' ? colors.white : colors.muted }}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${value} ${label}`}>
      {body}
    </Pressable>
  );
}

/**
 * A ticket: the pickup code, the permit. A white card with an accent band on top, a dashed tear
 * line between `head` and `stub` and the punched half-moon notches of a stub at both ends of it
 * (`notch` is the colour of the page behind the card).
 */
export function Pass({
  head,
  stub,
  style,
  accent = colors.brand,
  notch = colors.bg,
  accessibilityLabel,
}: {
  accessibilityLabel?: string;
  head: ReactNode;
  stub?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string;
  notch?: string;
}) {
  return (
    <View accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} style={[{ borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.raised }, style]}>
      <View style={{ borderRadius: radius.pass, borderCurve: 'continuous', overflow: 'hidden' }}>
        <View style={{ height: 8, backgroundColor: accent }} />
        <View style={{ padding: 20 }}>{head}</View>
        {stub ? (
          <>
            <View style={{ height: 24, justifyContent: 'center' }}>
              <View style={{ marginHorizontal: 22, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.line }} />
              <View style={{ position: 'absolute', left: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: notch }} />
              <View style={{ position: 'absolute', right: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: notch }} />
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 18 }}>{stub}</View>
          </>
        ) : null}
      </View>
    </View>
  );
}

/** A bar floating above the home indicator (cart, primary action on photo screens). */
export function FloatingBar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 12 }, style]}>
      {children}
    </View>
  );
}

/** Section title in the v5 rhythm: heavy title, optional note or action on the right. */
export function Section({ title, note, action, children, inset = 20 }: { title: string; note?: string; action?: { label: string; onPress: () => void }; children: ReactNode; inset?: number }) {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingHorizontal: inset }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, letterSpacing: -0.2, color: colors.ink }}>{title}</Text>
          {note ? <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 18, color: colors.muted }}>{note}</Text> : null}
        </View>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.primary }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type ImageSourcePropType } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { PASSWORD_RULES } from '@/core/auth/password-policy';
import type { RoleCode } from '@/core/types/role';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { daypart, IllustrativeTag, MEAL_WORD, Signboard, type Daypart } from '@/ui';

type IconSpec = { sf: string; md: string };

/** Three dishes of the hour in Đà Nẵng (the project's credited stock photos, `assets/images/food`). */
const MEAL_PHOTOS: Record<Daypart, ImageSourcePropType[]> = {
  morning: [require('@/assets/images/food/banh-mi.jpg'), require('@/assets/images/food/ca-phe.jpg'), require('@/assets/images/food/xoi-ga.jpg')],
  noon: [require('@/assets/images/food/com-tam.jpg'), require('@/assets/images/food/bun-cha.jpg'), require('@/assets/images/food/pho.jpg')],
  afternoon: [require('@/assets/images/food/banh-trang-nuong.jpg'), require('@/assets/images/food/che.jpg'), require('@/assets/images/food/tra-da.jpg')],
  evening: [require('@/assets/images/food/banh-xeo.jpg'), require('@/assets/images/food/do-nuong.jpg'), require('@/assets/images/food/nem-nuong.jpg')],
  night: [require('@/assets/images/food/hu-tieu.jpg'), require('@/assets/images/food/chao.jpg'), require('@/assets/images/food/sua-dau-nanh.jpg')],
};

/**
 * The door of the app (v5 "Biển hiệu phố"): the street-orange sign running under the status bar,
 * the StreetBiz mark on a white disc and the way in for guests on its top row, "STREETBIZ / VỈA HÈ
 * CÓ PHÉP" in sign lettering, and the dishes of the hour as an invitation. `overlap` is the form,
 * a white sheet rising across the painted kerb. The screen calls `useLightStatusBar()`.
 */
export function AuthSignboard({ overlap, onBrowse }: { overlap: ReactNode; onBrowse: () => void }) {
  const part = daypart();
  return (
    <Signboard
      top={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.card }}>
            <Image source={require('@/assets/brand/streetbiz-mark-orange.png')} style={{ width: 32, height: 32 }} contentFit="contain" accessibilityLabel="StreetBiz" />
          </View>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onBrowse}
            accessibilityRole="button"
            accessibilityLabel="Xem quán, không cần tài khoản"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              minHeight: 44,
              paddingHorizontal: 16,
              borderRadius: radius.full,
              backgroundColor: pressed ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.22)',
            })}
          >
            <Icon sf="fork.knife" md="restaurant" size={16} color={colors.white} />
            <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.white }}>Xem quán</Text>
          </Pressable>
        </View>
      }
      line1="StreetBiz"
      line2="Vỉa hè có phép"
      overlap={overlap}
    >
      {/* The invitation of the hour: three dishes, the way a stall shows what it is cooking */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row' }}>
          {MEAL_PHOTOS[part].map((src, i) => (
            <View
              key={i}
              style={{
                width: 58,
                height: 58,
                marginLeft: i ? -16 : 0,
                borderRadius: radius.full,
                borderWidth: 3,
                borderColor: colors.white,
                overflow: 'hidden',
                backgroundColor: colors.brandTint,
                transform: [{ rotate: `${(i - 1) * 4}deg` }],
              }}
            >
              <Image source={src} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 17, lineHeight: 23, color: colors.white }}>{`${MEAL_WORD[part]} ăn gì?`}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18, color: colors.white }}>Quán có phép ngay trên vỉa hè.</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: 'rgba(255,255,255,0.86)' }}>Ảnh minh họa</Text>
        </View>
      </View>
    </Signboard>
  );
}

/**
 * Screen title block for the auth and account forms (the native header only carries the back
 * arrow): an orange disc with the step's symbol, the title, one sentence.
 */
export function AuthTitle({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: IconSpec }) {
  return (
    <View style={{ gap: 8, marginBottom: 4 }}>
      {icon ? (
        <View style={{ width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 6, boxShadow: shadow.glow }}>
          <Icon sf={icon.sf} md={icon.md} size={26} color={colors.white} />
        </View>
      ) : null}
      <Text accessibilityRole="header" style={[text.title1, { color: colors.ink }]}>
        {title}
      </Text>
      {subtitle ? <Text style={[text.callout, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

/** The phone a code went to, painted like a street plate (ink, white rim, sign lettering). */
export function PhonePlate({ phone, label = 'Mã gửi tới số' }: { phone: string; label?: string }) {
  return (
    <View accessible accessibilityLabel={`${label} ${phone}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted }}>{label}</Text>
      <View style={{ paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: radius.plate, backgroundColor: colors.plate, borderWidth: 2, borderColor: colors.white, boxShadow: shadow.card }}>
        <Text maxFontSizeMultiplier={1.4} style={[sign.price, { color: colors.white, letterSpacing: 1 }, tabular]}>
          {phone}
        </Text>
      </View>
    </View>
  );
}

/** The resend cooldown on a mango sticker ("Gửi lại mã sau 0:42"), or nothing when it is over. */
export function ResendSticker({ seconds }: { seconds: number }) {
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <View
      accessible
      accessibilityLabel={`Gửi lại mã sau ${seconds} giây`}
      style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 40, borderRadius: radius.sticker, backgroundColor: colors.mangoTint, borderWidth: 1.5, borderColor: colors.sticker }}
    >
      <Icon sf="timer" md="timer" size={16} color={colors.onMango} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.onMango }}>Gửi lại mã sau</Text>
      <Text maxFontSizeMultiplier={1.4} style={[sign.price, { color: colors.plate }, tabular]}>
        {clock}
      </Text>
    </View>
  );
}

/** The four public legal pages, always reachable from the auth screens (as on the web). */
export function LegalLinks() {
  const links: { label: string; href: string }[] = [
    { label: 'Điều khoản', href: LEGAL_ROUTES.terms },
    { label: 'Bảo mật', href: LEGAL_ROUTES.privacy },
    { label: 'Quy định thuê ô', href: LEGAL_ROUTES.slotRules },
    { label: 'Căn cứ pháp lý', href: LEGAL_ROUTES.basis },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 18, marginTop: 4 }}>
      {links.map((l) => (
        <Pressable
          key={l.href}
          onPress={() => router.push(l.href as Href)}
          hitSlop={6}
          accessibilityRole="link"
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>{l.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A text link in the brand's readable orange. */
export function TextLink({
  label,
  onPress,
  align = 'center',
}: {
  label: string;
  onPress: () => void;
  align?: 'center' | 'flex-start' | 'flex-end';
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="link"
      style={{ alignSelf: align, minHeight: 44, justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.primary }}>{label}</Text>
    </Pressable>
  );
}

/** "Mật khẩu chưa đạt…": every rule ticks green as it is met (BR-59). */
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <View
            key={rule.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: radius.full,
              backgroundColor: ok ? colors.leafTint : colors.card,
              borderWidth: 1,
              borderColor: ok ? colors.leafTint : colors.line,
            }}
            accessibilityLabel={`${rule.label}: ${ok ? 'đạt' : 'chưa đạt'}`}
          >
            <Icon
              sf={ok ? 'checkmark.circle.fill' : 'circle'}
              md={ok ? 'check_circle' : 'radio_button_unchecked'}
              size={13}
              color={ok ? colors.leaf : colors.muted}
            />
            <Text style={{ fontFamily: ok ? fonts.bold : fonts.medium, fontSize: 12.5, color: ok ? colors.onLeaf : colors.muted }}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** A tick box with a sentence; the sentence can hold links (agreement to the terms). */
export function Checkbox({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          onChange(!checked);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.sticker,
            borderCurve: 'continuous',
            borderWidth: checked ? 0 : 1.5,
            borderColor: error ? colors.danger : colors.line,
            backgroundColor: checked ? colors.cta : colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          {checked ? <Icon sf="checkmark" md="check" size={15} color={colors.white} weight="bold" /> : null}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </Pressable>
      {error ? <Text style={[text.footnote, { color: colors.onDanger, marginLeft: 36 }]}>{error}</Text> : null}
    </View>
  );
}

export type SelfRole = Extract<RoleCode, 'CUSTOMER' | 'VENDOR'>;

const ROLE_CARDS: { role: SelfRole; title: string; line: string; icon: IconSpec; photo: ImageSourcePropType }[] = [
  {
    role: 'CUSTOMER',
    title: 'Người mua',
    line: 'Tìm quán có phép, đặt trước, đến lấy',
    icon: { sf: 'bag.fill', md: 'shopping_bag' },
    photo: require('@/assets/images/food/bun-cha.jpg'),
  },
  {
    role: 'VENDOR',
    title: 'Hộ kinh doanh',
    line: 'Đăng ký, thuê ô vỉa hè, nhận đơn',
    icon: { sf: 'storefront.fill', md: 'storefront' },
    photo: require('@/assets/images/food/banh-mi-thit-nuong.jpg'),
  },
];

/**
 * The two roles anyone can sign up as (BR-02); ward and admin accounts come from the ward.
 * v5: two photo cards; the chosen one wears an orange rim, a tick and the orange glow.
 */
export function RoleCards({ value, onChange }: { value: SelfRole; onChange: (r: SelfRole) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Bạn là</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {ROLE_CARDS.map((c) => {
          const on = c.role === value;
          return (
            <Pressable
              key={c.role}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(c.role);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${c.title}: ${c.line}`}
              style={({ pressed }) => ({
                flex: 1,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                borderWidth: 2.5,
                borderColor: on ? colors.cta : colors.card,
                backgroundColor: colors.card,
                boxShadow: on ? shadow.glow : shadow.card,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <View style={{ borderRadius: radius.card - 3, borderCurve: 'continuous', overflow: 'hidden' }}>
                <View style={{ height: 92, backgroundColor: colors.sunken }}>
                  <Image source={c.photo} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  <IllustrativeTag />
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: radius.full,
                      backgroundColor: on ? colors.cta : 'rgba(255,255,255,0.9)',
                      borderWidth: 2,
                      borderColor: colors.white,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on ? <Icon sf="checkmark" md="check" size={14} color={colors.white} weight="bold" /> : null}
                  </View>
                </View>
                <View style={{ padding: 12, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon sf={c.icon.sf} md={c.icon.md} size={16} color={on ? colors.primary : colors.muted} />
                    <Text style={{ flexShrink: 1, fontFamily: fonts.heavy, fontSize: 16, lineHeight: 21, color: on ? colors.primary : colors.ink }}>{c.title}</Text>
                  </View>
                  <Text style={[text.footnote, { color: colors.muted }]}>{c.line}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A small heavy title over a group of fields (the settings-style grouping of a long form). */
export function FieldGroupTitle({ title }: { title: string }) {
  return (
    <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink, marginTop: 6 }}>
      {title}
    </Text>
  );
}

/** Opens an auth route on top of the current one (keeps the form being filled). */
export const go = (href: string) => router.push(href as Href);

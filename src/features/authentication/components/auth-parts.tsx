import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { PASSWORD_RULES } from '@/core/auth/password-policy';
import type { RoleCode } from '@/core/types/role';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { colors, fonts, radius, text } from '@/theme';

/**
 * The top of the sign-in screen: the project's street photo washed in brand orange, the
 * StreetBiz mark and line, ending on the painted kerb where the form "sits on the pavement".
 */
export function AuthHero({ height = 300 }: { height?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ height: height + insets.top, overflow: 'hidden' }}>
      <Image
        source={require('@/assets/images/hero/hanoi-street-960.webp')}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        colors={['rgba(232,80,0,0.55)', 'rgba(238,85,0,0.82)', 'rgba(238,85,0,0.97)']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 18,
          paddingHorizontal: 22,
          paddingBottom: 38,
          justifyContent: 'flex-end',
          gap: 14,
        }}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: colors.white,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 24px -10px rgba(17, 28, 43, 0.45)',
          }}
        >
          <Image
            source={require('@/assets/brand/streetbiz-mark-orange.png')}
            style={{ width: 40, height: 40 }}
            contentFit="contain"
            accessibilityLabel="StreetBiz"
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 30, lineHeight: 36, color: colors.white }}>
            StreetBiz
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.white }}>
            Vỉa hè có trật tự, quán có khách.
          </Text>
        </View>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <KerbStrip height={8} segment={26} />
      </View>
    </View>
  );
}

/** Screen title block for the auth stack (the header only carries the back arrow). */
export function AuthTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 6, marginBottom: 4 }}>
      <Text accessibilityRole="header" style={[text.largeTitle, { fontSize: 28, lineHeight: 35, color: colors.ink }]}>
        {title}
      </Text>
      {subtitle ? <Text style={[text.callout, { color: colors.muted }]}>{subtitle}</Text> : null}
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
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 8 }}>
      {links.map((l) => (
        <Pressable
          key={l.href}
          onPress={() => router.push(l.href as Href)}
          hitSlop={8}
          accessibilityRole="link"
        >
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted }}>{l.label}</Text>
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
      hitSlop={10}
      accessibilityRole="link"
      style={{ alignSelf: align, paddingVertical: 6 }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }}>{label}</Text>
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
              gap: 4,
              paddingHorizontal: 9,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: ok ? colors.leafTint : colors.sunken,
            }}
            accessibilityLabel={`${rule.label}: ${ok ? 'đạt' : 'chưa đạt'}`}
          >
            <Icon
              sf={ok ? 'checkmark.circle.fill' : 'circle'}
              md={ok ? 'check_circle' : 'radio_button_unchecked'}
              size={12}
              color={ok ? colors.leaf : colors.muted}
            />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: ok ? colors.onLeaf : colors.muted }}>
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
            borderRadius: 7,
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

const ROLE_CARDS: { role: SelfRole; title: string; line: string; icon: { sf: string; md: string } }[] = [
  {
    role: 'CUSTOMER',
    title: 'Người mua',
    line: 'Tìm quán có phép, đặt trước, đến lấy',
    icon: { sf: 'bag.fill', md: 'shopping_bag' },
  },
  {
    role: 'VENDOR',
    title: 'Hộ kinh doanh',
    line: 'Đăng ký, thuê ô vỉa hè, nhận đơn',
    icon: { sf: 'storefront.fill', md: 'storefront' },
  },
];

/** The two roles anyone can sign up as (BR-02); ward and admin accounts come from the ward. */
export function RoleCards({ value, onChange }: { value: SelfRole; onChange: (r: SelfRole) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>Bạn là</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
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
              style={{
                flex: 1,
                padding: 14,
                gap: 8,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                borderWidth: on ? 2 : 1,
                borderColor: on ? colors.cta : colors.line,
                backgroundColor: on ? colors.brandTint : colors.card,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    backgroundColor: on ? colors.cta : colors.sunken,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon sf={c.icon.sf} md={c.icon.md} size={19} color={on ? colors.white : colors.muted} />
                </View>
                <Icon
                  sf={on ? 'checkmark.circle.fill' : 'circle'}
                  md={on ? 'check_circle' : 'radio_button_unchecked'}
                  size={20}
                  color={on ? colors.cta : colors.line}
                />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>{c.title}</Text>
              <Text style={[text.footnote, { color: colors.muted }]}>{c.line}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Opens an auth route on top of the current one (keeps the form being filled). */
export const go = (href: string) => router.push(href as Href);

import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { PasswordField, PhoneField } from '@/components/forms/TextField';
import { ApiError, errorMessage } from '@/core/api';
import { isDev } from '@/core/config/env';
import type { RoleCode } from '@/core/types/role';
import { phoneError, toLocalPhone } from '@/core/utils/phone';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, text } from '@/theme';
import { useLightStatusBar } from '@/ui';
import { AuthSignboard, go, LegalLinks, TextLink } from '../components/auth-parts';
import { COME_BACK_PARAM, leaveSignIn } from '../sign-in-return';

/** The seeded demo accounts (StreetBiz-BE `docs/database.md`), offered on development builds only, as on the web. */
const DEMO: { role: RoleCode; label: string; phone: string }[] = [
  { role: 'CUSTOMER', label: 'Người mua', phone: '0905000201' },
  { role: 'VENDOR', label: 'Hộ kinh doanh', phone: '0905000101' },
  { role: 'WARD_AUTHORITY', label: 'Cán bộ Phường', phone: '0983000001' },
  { role: 'PLATFORM_ADMIN', label: 'Quản trị viên', phone: '0900000001' },
];
const DEMO_PASSWORD = 'Password123!';

/**
 * A01 Đăng nhập (AUTH-03), v5 "Biển hiệu phố" (screens/v5/shared-admin.md): the orange street
 * sign with the dishes of the hour; the form is a white sheet rising across the painted kerb,
 * its primary button under the thumb. Wrong input is said under its field; a server error in a
 * banner. Signing in lands on the role's home, or back on the form that asked for it (`?back=1`).
 */
export function SignInScreen() {
  useLightStatusBar();
  const comeBack = useLocalSearchParams<{ [COME_BACK_PARAM]?: string }>()[COME_BACK_PARAM] === '1';
  const signIn = useAuthStore((s) => s.signIn);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const clearSessionExpired = useAuthStore((s) => s.clearSessionExpired);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => clearSessionExpired, [clearSessionExpired]);

  const submit = async () => {
    if (busy) return;
    const next = {
      phone: phoneError(phone),
      password: password ? undefined : 'Vui lòng nhập mật khẩu.',
    };
    setErrors(next);
    if (next.phone || next.password) return;
    setError(undefined);
    setBusy(true);
    try {
      const user = await signIn(toLocalPhone(phone), password);
      leaveSignIn(user.role_code, comeBack);
    } catch (err) {
      if (err instanceof ApiError && err.isValidation) {
        setErrors({
          phone: err.fieldError('PhoneNumber'),
          password: err.fieldError('Password'),
        });
        if (!err.fieldError('PhoneNumber') && !err.fieldError('Password')) setError(err.message);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  // The form: a white sheet laid across the sign's kerb.
  const form = (
    <View style={{ padding: 20, gap: 16, borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.raised }}>
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={[text.title2, { color: colors.ink }]}>
          Đăng nhập
        </Text>
        <Text style={[text.footnote, { color: colors.muted }]}>Một tài khoản cho người mua, người bán và cán bộ phường.</Text>
      </View>

      {sessionExpired ? (
        <Banner tone="warning">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <PhoneField
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
        }}
        error={errors.phone}
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <View style={{ gap: 0 }}>
        <PasswordField
          ref={passwordRef}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
          }}
          error={errors.password}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <TextLink
          label="Quên mật khẩu?"
          align="flex-end"
          onPress={() => go('/auth/password/reset-request')}
        />
      </View>

      <Button label="Đăng nhập" size={56} loading={busy} onPress={submit} />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        style={{ backgroundColor: colors.bg }}
      >
        <AuthSignboard overlap={form} onBrowse={() => router.replace('/customer/explore' as Href)} />

        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>hoặc</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          </View>

          <Button
            label="Đăng nhập bằng mã OTP"
            variant="secondary"
            icon={{ sf: 'message.badge.fill', md: 'sms' }}
            onPress={() => go(comeBack ? `/auth/sign-in/otp?${COME_BACK_PARAM}=1` : '/auth/sign-in/otp')}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted }}>
              Chưa có tài khoản?
            </Text>
            <TextLink label="Đăng ký ngay" onPress={() => go('/auth/register')} />
          </View>

          {isDev ? (
            <View style={{ gap: 10, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon sf="hammer.fill" md="build" size={15} color={colors.muted} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>
                  Tài khoản mẫu (bản phát triển)
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {DEMO.map((d) => (
                  <Pressable
                    key={d.role}
                    onPress={() => {
                      setPhone(d.phone);
                      setPassword(DEMO_PASSWORD);
                      setErrors({});
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Điền nhanh tài khoản mẫu ${d.label}`}
                    style={({ pressed }) => ({
                      minHeight: 40,
                      justifyContent: 'center',
                      paddingHorizontal: 14,
                      borderRadius: radius.full,
                      backgroundColor: pressed ? colors.brandTint : colors.sunken,
                    })}
                  >
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink }}>{d.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <LegalLinks />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

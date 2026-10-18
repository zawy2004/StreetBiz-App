import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { PasswordField, PhoneField } from '@/components/forms/TextField';
import { ApiError, errorMessage } from '@/core/api';
import { ROLE_HOME_ROUTE } from '@/core/auth/role-routes';
import { isDev } from '@/core/config/env';
import type { RoleCode } from '@/core/types/role';
import { phoneError, toLocalPhone } from '@/core/utils/phone';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius } from '@/theme';
import { AuthHero, go, LegalLinks, TextLink } from '../components/auth-parts';

/** The seeded demo accounts (StreetBiz-BE `docs/database.md`), offered on development builds only, as on the web. */
const DEMO: { role: RoleCode; label: string; phone: string }[] = [
  { role: 'CUSTOMER', label: 'Người mua', phone: '0905000201' },
  { role: 'VENDOR', label: 'Hộ kinh doanh', phone: '0905000101' },
  { role: 'WARD_AUTHORITY', label: 'Cán bộ Phường', phone: '0983000001' },
  { role: 'PLATFORM_ADMIN', label: 'Quản trị viên', phone: '0900000001' },
];
const DEMO_PASSWORD = 'Password123!';

/**
 * A01 Đăng nhập (AUTH-03): the street photo up top, the form on a sheet that rises from the
 * kerb, the primary button under the thumb. Wrong input is said under its field; a server
 * error in a banner. Signing in lands on the role's home.
 */
export function SignInScreen() {
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
      router.replace(ROLE_HOME_ROUTE[user.role_code] as Href);
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
        <AuthHero height={250} />
        <View
          style={{
            marginTop: -2,
            paddingHorizontal: 20,
            paddingTop: 24,
            gap: 16,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text
              accessibilityRole="header"
              style={{ fontFamily: fonts.heavy, fontSize: 26, lineHeight: 32, color: colors.ink }}
            >
              Đăng nhập
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted }}>
              Quản lý kinh doanh vỉa hè, minh bạch và đơn giản.
            </Text>
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
          <View style={{ gap: 2 }}>
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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted }}>hoặc</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          </View>

          <Button
            label="Đăng nhập bằng mã OTP"
            variant="secondary"
            icon={{ sf: 'message.badge.fill', md: 'sms' }}
            onPress={() => go('/auth/sign-in/otp')}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted }}>
              Chưa có tài khoản?
            </Text>
            <TextLink label="Đăng ký ngay" onPress={() => go('/auth/register')} />
          </View>

          <Pressable
            onPress={() => router.replace('/customer/explore' as Href)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              backgroundColor: pressed ? colors.brandTint : colors.card,
              borderWidth: 1,
              borderColor: colors.brandTint,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.brandTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon sf="fork.knife" md="restaurant" size={19} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>
                Xem quán, không cần tài khoản
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted }}>
                Khách vẫn tìm được quán có phép và kiểm tra giấy phép.
              </Text>
            </View>
          </Pressable>

          {isDev ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>
                Tài khoản mẫu (bản phát triển)
              </Text>
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
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: pressed ? colors.sunken : colors.card,
                      borderWidth: 1,
                      borderColor: colors.line,
                    })}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.ink }}>{d.label}</Text>
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

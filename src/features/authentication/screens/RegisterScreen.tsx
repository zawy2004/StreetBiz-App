import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Sheet } from '@/components/common/Sheet';
import { Banner } from '@/components/feedback/Banner';
import { PasswordField, PhoneField, TextField } from '@/components/forms/TextField';
import { WardPickerList } from '@/components/forms/WardPickerList';
import { Screen } from '@/components/layout/Screen';
import { ApiError, authApi, errorMessage, OTP_PURPOSE } from '@/core/api';
import { isPasswordValid, passwordError } from '@/core/auth/password-policy';
import { useWards } from '@/core/auth/useWards';
import { phoneError, toLocalPhone } from '@/core/utils/phone';
import { LEGAL_ROUTES } from '@/features/legal/legal-content';
import { colors, fonts, radius } from '@/theme';
import {
  AuthTitle,
  Checkbox,
  FieldGroupTitle,
  go,
  PasswordChecklist,
  RoleCards,
  TextLink,
  type SelfRole,
} from '../components/auth-parts';
import { usePendingAuthStore } from '../pending-auth-store';

/**
 * A02 Đăng ký (AUTH-01, AUTH-02): role, name, phone, optional ward, password twice, the
 * terms. Valid input asks for a registration code, then the verify step creates the
 * account. A phone that already has an account is said under the phone field.
 */
export function RegisterScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const startRegistration = usePendingAuthStore((s) => s.startRegistration);
  const { wards, loading: wardsLoading } = useWards();
  const [role, setRole] = useState<SelfRole>(params.role === 'VENDOR' ? 'VENDOR' : 'CUSTOMER');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [wardUnitId, setWardUnitId] = useState<number>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string>();
  const [phoneRegistered, setPhoneRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wardSheet, setWardSheet] = useState(false);
  const phoneRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const ward = wards.find((w) => w.unitId === wardUnitId);

  const submit = async () => {
    if (busy) return;
    const next: Record<string, string | undefined> = {};
    if (!fullName.trim()) next.fullName = 'Vui lòng nhập họ tên.';
    next.phone = phoneError(phone);
    if (!isPasswordValid(password)) next.password = passwordError(password);
    else if (password !== confirm) next.confirm = 'Mật khẩu nhập lại không khớp.';
    if (!agreed) next.agreement = 'Vui lòng đồng ý Điều khoản sử dụng và Chính sách bảo mật.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      setError(undefined);
      return;
    }
    const pending = {
      phoneNumber: toLocalPhone(phone),
      fullName: fullName.trim(),
      password,
      roleCode: role,
      wardUnitId: wardUnitId ?? null,
    };
    const goToVerify = (resendAvailableIn?: number) => {
      startRegistration(pending, resendAvailableIn);
      router.push({ pathname: '/auth/verify-phone', params: { purpose: OTP_PURPOSE.register } });
    };
    setError(undefined);
    setPhoneRegistered(false);
    setBusy(true);
    try {
      await authApi.sendOtp(pending.phoneNumber, OTP_PURPOSE.register);
      goToVerify();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'otp_cooldown') {
        // A code sent less than a minute ago is still valid: carry on to verify it.
        goToVerify(err.retryAfterSeconds);
      } else if (err instanceof ApiError && err.code === 'conflict') {
        setErrors({ phone: err.message });
        setPhoneRegistered(true);
      } else if (err instanceof ApiError && err.isValidation) {
        setErrors({ phone: err.fieldError('PhoneNumber') });
        setError(err.fieldError('PhoneNumber') ? undefined : err.message);
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Tiếp tục" size={56} loading={busy} onPress={submit} />}>
      <AuthTitle
        title="Tạo tài khoản"
        subtitle="Chọn vai trò để bắt đầu. Mất chưa tới một phút."
        icon={{ sf: 'person.crop.circle.badge.plus', md: 'person_add' }}
      />
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <RoleCards value={role} onChange={setRole} />

      <FieldGroupTitle title="Thông tin của bạn" />
      <TextField
        label="Họ và tên"
        icon={{ sf: 'person.fill', md: 'person' }}
        value={fullName}
        onChangeText={(v) => {
          setFullName(v);
          setErrors((e) => ({ ...e, fullName: undefined }));
        }}
        error={errors.fullName}
        placeholder="Nguyễn Văn A"
        textContentType="name"
        autoComplete="name"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        submitBehavior="submit"
      />
      <View style={{ gap: 4 }}>
        <PhoneField
          ref={phoneRef}
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            setPhoneRegistered(false);
            setErrors((e) => ({ ...e, phone: undefined }));
          }}
          error={errors.phone}
          onSubmitEditing={() => passRef.current?.focus()}
          submitBehavior="submit"
        />
        {phoneRegistered ? (
          <TextLink label="Đăng nhập bằng số này" align="flex-start" onPress={() => router.back()} />
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }}>
          Phường/xã <Text style={{ fontFamily: fonts.regular, color: colors.muted }}>(không bắt buộc)</Text>
        </Text>
        {/* A picker row like the fields around it: opens the ward sheet */}
        <Pressable
          onPress={() => setWardSheet(true)}
          disabled={wardsLoading}
          accessibilityRole="button"
          accessibilityLabel={ward ? `Phường/xã: ${ward.unitName}. Đổi` : 'Chọn phường nơi bạn ở'}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 56,
            paddingHorizontal: 16,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            backgroundColor: pressed ? colors.brandTint : colors.sunken,
            opacity: wardsLoading ? 0.6 : 1,
          })}
        >
          <Icon sf="mappin.and.ellipse" md="location_on" size={18} color={ward ? colors.primary : colors.muted} />
          <Text numberOfLines={2} style={{ flex: 1, fontFamily: ward ? fonts.semibold : fonts.regular, fontSize: 16, color: ward ? colors.ink : colors.muted }}>
            {ward ? ward.unitName : wardsLoading ? 'Đang tải danh sách phường…' : 'Chọn phường nơi bạn ở'}
          </Text>
          <Icon sf="chevron.down" md="expand_more" size={15} color={colors.muted} />
        </Pressable>
      </View>

      <FieldGroupTitle title="Mật khẩu" />
      <View style={{ gap: 10 }}>
        <PasswordField
          ref={passRef}
          isNew
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setErrors((e) => ({ ...e, password: undefined }));
          }}
          error={errors.password}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          submitBehavior="submit"
        />
        <PasswordChecklist value={password} />
      </View>
      <PasswordField
        ref={confirmRef}
        isNew
        label="Nhập lại mật khẩu"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          setErrors((e) => ({ ...e, confirm: undefined }));
        }}
        error={errors.confirm}
        returnKeyType="done"
      />

      <Checkbox
        checked={agreed}
        onChange={(v) => {
          setAgreed(v);
          if (v) setErrors((e) => ({ ...e, agreement: undefined }));
        }}
        error={errors.agreement}
      >
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink }}>
          Tôi đồng ý{' '}
          <Text style={{ fontFamily: fonts.bold, color: colors.primary }} onPress={() => go(LEGAL_ROUTES.terms)}>
            Điều khoản sử dụng
          </Text>{' '}
          và{' '}
          <Text style={{ fontFamily: fonts.bold, color: colors.primary }} onPress={() => go(LEGAL_ROUTES.privacy)}>
            Chính sách bảo mật
          </Text>
          .
        </Text>
      </Checkbox>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted }}>Đã có tài khoản?</Text>
        <TextLink label="Đăng nhập" onPress={() => router.back()} />
      </View>

      <Sheet
        visible={wardSheet}
        onClose={() => setWardSheet(false)}
        title="Phường/xã"
        subtitle="Giúp phường liên hệ khi cần. Có thể bỏ qua."
      >
        <WardPickerList
          wards={wards}
          selectedId={wardUnitId}
          icon={{ sf: 'mappin.and.ellipse', md: 'location_on' }}
          onPick={(w) => {
            setWardUnitId(w.unitId === wardUnitId ? undefined : w.unitId);
            setWardSheet(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}

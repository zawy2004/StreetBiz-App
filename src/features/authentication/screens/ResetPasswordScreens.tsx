import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Banner } from '@/components/feedback/Banner';
import { PasswordField, PhoneField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { showToast } from '@/components/feedback/Toast';
import { ApiError, authApi, errorMessage, OTP_PURPOSE } from '@/core/api';
import { isPasswordValid, passwordError } from '@/core/auth/password-policy';
import { formatPhone, phoneError, toLocalPhone } from '@/core/utils/phone';
import { AuthTitle, PasswordChecklist, PhonePlate, TextLink } from '../components/auth-parts';
import { usePendingAuthStore } from '../pending-auth-store';

/**
 * A04 Quên mật khẩu (AUTH-05): asks for a reset code. The answer is the same whether or not
 * the phone has an account, so the screen always moves on to the code step.
 */
export function ResetPasswordRequestScreen() {
  const startReset = usePendingAuthStore((s) => s.startReset);
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = phoneError(phone);
    setPhoneErr(e);
    if (e || busy) return;
    setError(undefined);
    setBusy(true);
    const local = toLocalPhone(phone);
    try {
      await authApi.forgotPassword(local);
      startReset(local);
      router.push({ pathname: '/auth/verify-phone', params: { purpose: OTP_PURPOSE.passwordReset } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'otp_cooldown') {
        startReset(local);
        router.push({ pathname: '/auth/verify-phone', params: { purpose: OTP_PURPOSE.passwordReset } });
      } else if (err instanceof ApiError && err.isValidation) {
        setPhoneErr(err.fieldError('PhoneNumber') ?? err.message);
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Gửi mã đặt lại" size={56} loading={busy} onPress={submit} />}>
      <AuthTitle
        title="Quên mật khẩu"
        subtitle="Nhập số điện thoại của tài khoản. Nếu số này đã đăng ký, bạn sẽ nhận mã để đặt mật khẩu mới."
        icon={{ sf: 'key.fill', md: 'key' }}
      />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <PhoneField
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          setPhoneErr(undefined);
        }}
        error={phoneErr}
        autoFocus
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <TextLink label="Nhớ ra mật khẩu? Đăng nhập" onPress={() => router.back()} />
    </Screen>
  );
}

/** A05 Đặt mật khẩu mới (AUTH-06) with the code from the previous step. */
export function ResetPasswordScreen() {
  const reset = usePendingAuthStore((s) => s.reset);
  const clear = usePendingAuthStore((s) => s.clear);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string>();
  const [otpRejected, setOtpRejected] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!reset?.phoneNumber || !reset.otp) return <Redirect href="/auth/password/reset-request" />;

  const submit = async () => {
    if (busy) return;
    const next = {
      password: isPasswordValid(password) ? undefined : passwordError(password),
      confirm: password === confirm ? undefined : 'Mật khẩu nhập lại không khớp.',
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    setError(undefined);
    setBusy(true);
    try {
      await authApi.resetPassword(reset.phoneNumber, reset.otp!, password);
      clear();
      showToast('Đã đặt mật khẩu mới. Hãy đăng nhập lại.');
      router.dismissTo('/auth/sign-in');
    } catch (err) {
      if (err instanceof ApiError && err.isValidation && err.fieldError('Otp')) {
        setOtpRejected(true);
        setError(err.fieldError('Otp'));
      } else if (err instanceof ApiError && err.isValidation) {
        setErrors({ password: err.fieldError('NewPassword') ?? err.message });
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Đặt mật khẩu mới" size={56} loading={busy} onPress={submit} />}>
      <AuthTitle title="Đặt mật khẩu mới" icon={{ sf: 'lock.rotation', md: 'lock_reset' }} />
      <PhonePlate label="Cho tài khoản" phone={formatPhone(reset.phoneNumber)} />
      {error ? (
        <Banner
          tone="danger"
          action={otpRejected ? { label: 'Nhận mã mới', onPress: () => router.dismissTo('/auth/password/reset-request') } : undefined}
        >
          {error}
        </Banner>
      ) : null}
      <View style={{ gap: 10 }}>
        <PasswordField
          isNew
          label="Mật khẩu mới"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setErrors((e) => ({ ...e, password: undefined }));
          }}
          error={errors.password}
          autoFocus
        />
        <PasswordChecklist value={password} />
      </View>
      <PasswordField
        isNew
        label="Nhập lại mật khẩu mới"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          setErrors((e) => ({ ...e, confirm: undefined }));
        }}
        error={errors.confirm}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
    </Screen>
  );
}

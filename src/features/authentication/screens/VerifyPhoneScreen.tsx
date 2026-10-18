import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Banner } from '@/components/feedback/Banner';
import { OtpField } from '@/components/forms/OtpField';
import { Screen } from '@/components/layout/Screen';
import { ApiError, authApi, errorMessage, OTP_PURPOSE } from '@/core/api';
import { ROLE_HOME_ROUTE } from '@/core/auth/role-routes';
import { formatPhone } from '@/core/utils/phone';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts } from '@/theme';
import { AuthTitle, TextLink } from '../components/auth-parts';
import { usePendingAuthStore } from '../pending-auth-store';

const RESEND_SECONDS = 60; // the backend cooldown (BR-61)
const OTP_LENGTH = 6;

/**
 * A03 Xác minh số điện thoại. For a registration the code is spent by `POST /auth/register`,
 * which creates the account and keeps the session: a vendor goes on to the onboarding
 * checklist, a buyer to Khám phá. For a password reset the code moves on to the new-password
 * step. The details typed before live only in memory, never in the URL.
 */
export function VerifyPhoneScreen() {
  const { purpose } = useLocalSearchParams<{ purpose?: string }>();
  const isRegistration = purpose !== OTP_PURPOSE.passwordReset;
  const registration = usePendingAuthStore((s) => s.registration);
  const reset = usePendingAuthStore((s) => s.reset);
  const resendAvailableIn = usePendingAuthStore((s) => s.resendAvailableIn);
  const setResetOtp = usePendingAuthStore((s) => s.setResetOtp);
  const clear = usePendingAuthStore((s) => s.clear);
  const register = useAuthStore((s) => s.register);
  const phone = isRegistration ? registration?.phoneNumber : reset?.phoneNumber;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { seconds, start, isRunning } = useCountdown(resendAvailableIn ?? RESEND_SECONDS);

  // Opened without the previous step (a stale link): go back to where it starts.
  if (!phone) {
    return <Redirect href={isRegistration ? '/auth/register' : '/auth/password/reset-request'} />;
  }

  const verify = async (value = code) => {
    if (value.length < OTP_LENGTH) {
      setError(`Vui lòng nhập đủ ${OTP_LENGTH} số.`);
      return;
    }
    if (busy) return;
    setError(undefined);
    if (!isRegistration) {
      setResetOtp(value);
      router.replace('/auth/password/reset');
      return;
    }
    if (!registration) return;
    setBusy(true);
    try {
      const user = await register({ ...registration, otp: value });
      clear();
      router.dismissAll();
      router.replace(
        (user.role_code === 'VENDOR' ? '/vendor/home/onboarding' : ROLE_HOME_ROUTE[user.role_code]) as Href,
      );
    } catch (err) {
      setCode('');
      if (err instanceof ApiError && err.isValidation) {
        setError(
          err.fieldError('Otp') ?? err.fieldError('Password') ?? err.fieldError('WardUnitId') ?? err.message,
        );
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (isRunning) return;
    setError(undefined);
    try {
      // A reset goes through forgot-password so unregistered numbers are never texted.
      if (isRegistration) await authApi.sendOtp(phone, OTP_PURPOSE.register);
      else await authApi.forgotPassword(phone);
      start(RESEND_SECONDS);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'otp_cooldown' && err.retryAfterSeconds) {
        start(err.retryAfterSeconds);
      } else setError(errorMessage(err));
    }
  };

  return (
    <Screen
      footer={
        <Button
          label={isRegistration ? 'Tạo tài khoản' : 'Tiếp tục'}
          size={56}
          loading={busy}
          onPress={() => verify()}
        />
      }
    >
      <AuthTitle
        title="Xác minh số điện thoại"
        subtitle={`Nhập mã ${OTP_LENGTH} số vừa gửi tới ${formatPhone(phone)}.`}
      />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <OtpField value={code} onChange={setCode} onComplete={verify} error={!!error} autoFocus />
      <View style={{ alignItems: 'center' }}>
        {isRunning ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.muted }}>
            Gửi lại mã sau {seconds} giây
          </Text>
        ) : (
          <TextLink label="Gửi lại mã" onPress={resend} />
        )}
      </View>
      <TextLink label="Sửa thông tin" onPress={() => router.back()} />
    </Screen>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Banner } from '@/components/feedback/Banner';
import { OtpField } from '@/components/forms/OtpField';
import { PhoneField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ApiError, authApi, errorMessage, OTP_PURPOSE } from '@/core/api';
import { formatPhone, phoneError, toLocalPhone } from '@/core/utils/phone';
import { useCountdown } from '@/hooks/useCountdown';
import { useAuthStore } from '@/store/auth-store';
import { AuthTitle, LegalLinks, PhonePlate, ResendSticker, TextLink } from '../components/auth-parts';
import { COME_BACK_PARAM, leaveSignIn } from '../sign-in-return';

const RESEND_SECONDS = 60; // the backend OTP cooldown (BR-61)
const OTP_LENGTH = 6;

/**
 * A06 Đăng nhập bằng mã OTP: two steps on one screen. The code is sent uniformly whether
 * or not the phone has an account (the backend never says), then signs straight in.
 */
export function OtpSignInScreen() {
  const comeBack = useLocalSearchParams<{ [COME_BACK_PARAM]?: string }>()[COME_BACK_PARAM] === '1';
  const signInWithOtp = useAuthStore((s) => s.signInWithOtp);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneErr, setPhoneErr] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { seconds, start, isRunning } = useCountdown(0);

  const send = async () => {
    const e = phoneError(phone);
    setPhoneErr(e);
    if (e || busy) return;
    setError(undefined);
    setBusy(true);
    try {
      await authApi.sendOtp(toLocalPhone(phone), OTP_PURPOSE.login);
      start(RESEND_SECONDS);
      setStep('code');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'otp_cooldown') {
        start(err.retryAfterSeconds ?? RESEND_SECONDS);
        setStep('code');
      } else if (err instanceof ApiError && err.isValidation) {
        setPhoneErr(err.fieldError('PhoneNumber') ?? err.message);
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.length < OTP_LENGTH) {
      setError(`Vui lòng nhập đủ ${OTP_LENGTH} số.`);
      return;
    }
    if (busy) return;
    setError(undefined);
    setBusy(true);
    try {
      const user = await signInWithOtp(toLocalPhone(phone), value);
      leaveSignIn(user.role_code, comeBack, true);
    } catch (err) {
      setError(err instanceof ApiError && err.isValidation ? (err.fieldError('Otp') ?? err.message) : errorMessage(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (isRunning || busy) return;
    setError(undefined);
    try {
      await authApi.sendOtp(toLocalPhone(phone), OTP_PURPOSE.login);
      start(RESEND_SECONDS);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'otp_cooldown' && err.retryAfterSeconds) {
        start(err.retryAfterSeconds);
      } else setError(errorMessage(err));
    }
  };

  if (step === 'phone') {
    return (
      <Screen footer={<Button label="Gửi mã OTP" size={56} loading={busy} onPress={send} />}>
        <AuthTitle
          title="Đăng nhập bằng mã OTP"
          subtitle="Không cần mật khẩu: chúng tôi gửi mã xác thực tới số điện thoại của bạn."
          icon={{ sf: 'message.badge.fill', md: 'sms' }}
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
          onSubmitEditing={send}
        />
        <TextLink label="Đăng nhập bằng mật khẩu" onPress={() => router.back()} />
        <LegalLinks />
      </Screen>
    );
  }

  return (
    <Screen
      footer={<Button label="Đăng nhập" size={56} loading={busy} onPress={() => verify()} />}
    >
      <AuthTitle
        title="Nhập mã xác thực"
        subtitle={`Nhập mã ${OTP_LENGTH} số vừa gửi qua tin nhắn.`}
        icon={{ sf: 'lock.shield.fill', md: 'shield_lock' }}
      />
      <PhonePlate phone={formatPhone(phone)} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <OtpField value={code} onChange={setCode} onComplete={verify} error={!!error} autoFocus />
      <View style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
        {isRunning ? <ResendSticker seconds={seconds} /> : <TextLink label="Gửi lại mã" onPress={resend} />}
      </View>
      <TextLink
        label="Đổi số điện thoại"
        onPress={() => {
          setStep('phone');
          setCode('');
          setError(undefined);
        }}
      />
    </Screen>
  );
}

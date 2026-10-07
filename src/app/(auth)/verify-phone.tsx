import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { OtpInput } from '@/components/forms/OtpInput';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { authApi, OTP_PURPOSE } from '@/core/api/auth-api';
import { errorMessage } from '@/core/api/problem';
import { isDev, isLiveApi } from '@/core/config/env';
import { goRoot } from '@/core/navigation/go';
import { createAccount } from '@/features/auth/create-account';
import { usePendingAuth } from '@/features/auth/pending-store';
import { ROLE_HOME, useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';

const RESEND_SECONDS = 60;

export default function VerifyPhoneScreen() {
  const account = usePendingAuth((s) => s.account);
  const setAccount = usePendingAuth((s) => s.setAccount);
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(RESEND_SECONDS);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  if (!account) {
    // Once the account is created the screen is on its way out; do not bounce back to register.
    return done ? null : <Redirect href={'/(auth)/register' as never} />;
  }

  async function confirm() {
    if (code.length !== 6 || !account) {
      setError('Nhập đủ 6 số');
      return;
    }
    setBusy(true);
    try {
      const user = isLiveApi
        ? useAuthStore.getState().acceptSession(
            await authApi.register({
              phoneNumber: account.phone,
              password: account.password,
              fullName: account.fullName,
              roleCode: account.role,
              wardUnitId: null,
              otp: code,
            }),
          )
        : createAccount(account);
      if (!isLiveApi) useAuthStore.setState({ user });
      setDone(true);
      setAccount(null);
      goRoot(ROLE_HOME[user.role_code]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!account) return;
    setError(undefined);
    try {
      if (isLiveApi) await authApi.sendOtp(account.phone, OTP_PURPOSE.register);
      setLeft(RESEND_SECONDS);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <StackHeader title="Xác thực" />
      <Screen footer={<Button label="Xác nhận" loading={busy} onPress={() => void confirm()} testID="verify-submit" />}>
        <AppText variant="display">Nhập mã 6 số</AppText>
        <AppText color="muted">Đã gửi tới {account.phone}</AppText>
        <OtpInput value={code} onChangeText={(v) => { setCode(v); setError(undefined); }} />
        {error ? <AppText variant="small" color="error">{error}</AppText> : null}
        {isLiveApi && isDev ? (
          <AppText variant="caption" color="muted">Môi trường phát triển: mã OTP được in trong cửa sổ chạy API (dòng [DEV-SMS]).</AppText>
        ) : null}
        {left > 0 ? (
          <AppText color="muted" align="center" style={styles.resend}>Gửi lại mã sau {left} giây</AppText>
        ) : (
          <Button label="Gửi lại mã" variant="ghost" fullWidth={false} onPress={() => void resend()} />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({ resend: { marginTop: spacing.sm } });

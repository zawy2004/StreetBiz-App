import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { OtpInput } from '@/components/forms/OtpInput';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { createAccount } from '@/features/auth/create-account';
import { usePendingAuth } from '@/features/auth/pending-store';
import { ROLE_HOME, useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';

const RESEND_SECONDS = 45;

export default function VerifyPhoneScreen() {
  const account = usePendingAuth((s) => s.account);
  const setAccount = usePendingAuth((s) => s.setAccount);
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(RESEND_SECONDS);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  if (!account) {
    return <Redirect href={'/(auth)/register' as never} />;
  }

  function confirm() {
    if (code.length !== 6 || !account) {
      setError('Nhập đủ 6 số');
      return;
    }
    const user = createAccount(account);
    useAuthStore.setState({ user });
    setAccount(null);
    router.replace(ROLE_HOME[user.role_code] as never);
  }

  return (
    <>
      <StackHeader title="Xác thực" />
      <Screen footer={<Button label="Xác nhận" onPress={confirm} testID="verify-submit" />}>
        <AppText variant="display">Nhập mã 6 số</AppText>
        <AppText color="muted">Đã gửi tới {account.phone}</AppText>
        <OtpInput value={code} onChangeText={(v) => { setCode(v); setError(undefined); }} />
        {error ? <AppText variant="small" color="error">{error}</AppText> : null}
        {left > 0 ? (
          <AppText color="muted" align="center" style={styles.resend}>Gửi lại mã sau {left} giây</AppText>
        ) : (
          <Button label="Gửi lại mã" variant="ghost" fullWidth={false} onPress={() => setLeft(RESEND_SECONDS)} />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({ resend: { marginTop: spacing.sm } });

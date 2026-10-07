import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { authApi } from '@/core/api/auth-api';
import { errorMessage } from '@/core/api/problem';
import { isLiveApi } from '@/core/config/env';
import { phoneExists } from '@/features/auth/create-account';
import { usePendingAuth } from '@/features/auth/pending-store';

export default function ResetRequestScreen() {
  const setResetPhone = usePendingAuth((s) => s.setResetPhone);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) return setError('Số điện thoại gồm 10 số');
    if (isLiveApi) {
      // AUTH-05 answers the same whether or not the number has an account.
      setBusy(true);
      try {
        await authApi.forgotPassword(digits);
      } catch (e) {
        return setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    } else if (!phoneExists(phone)) {
      return setError('Số điện thoại chưa đăng ký');
    }
    setResetPhone(digits);
    router.push('/(auth)/reset-password' as never);
  }

  return (
    <>
      <StackHeader title="Quên mật khẩu" />
      <Screen footer={<Button label="Gửi mã" loading={busy} onPress={() => void submit()} />}>
        <AppText variant="display">Nhập số điện thoại</AppText>
        <AppText color="muted">Chúng tôi sẽ gửi mã xác nhận để đặt mật khẩu mới</AppText>
        <TextField
          label="Số điện thoại"
          icon="phone-outline"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            setError(undefined);
          }}
          error={error}
        />
      </Screen>
    </>
  );
}

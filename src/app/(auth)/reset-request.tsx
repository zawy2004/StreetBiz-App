import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { phoneExists } from '@/features/auth/create-account';
import { usePendingAuth } from '@/features/auth/pending-store';

export default function ResetRequestScreen() {
  const setResetPhone = usePendingAuth((s) => s.setResetPhone);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string>();

  function submit() {
    if (!phoneExists(phone)) {
      setError('Số điện thoại chưa đăng ký');
      return;
    }
    setResetPhone(phone);
    router.push('/(auth)/reset-password' as never);
  }

  return (
    <>
      <StackHeader title="Quên mật khẩu" />
      <Screen footer={<Button label="Gửi mã" onPress={submit} />}>
        <AppText variant="display">Nhập số điện thoại</AppText>
        <AppText color="muted">Chúng tôi sẽ gửi mã xác nhận</AppText>
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

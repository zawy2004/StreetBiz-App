import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { PasswordField } from '@/components/forms/PasswordField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { errorMessage } from '@/core/api/problem';
import { RequireAuth } from '@/core/auth/guards';
import { PASSWORD_HINT, passwordProblem } from '@/core/auth/password-policy';
import { useChangePassword } from '@/features/account/use-account';

export default function ChangePasswordScreen() {
  return (
    <RequireAuth>
      <ChangePassword />
    </RequireAuth>
  );
}

function ChangePassword() {
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; again?: string }>({});

  async function submit() {
    const found: typeof errors = {};
    if (!current) found.current = 'Nhập mật khẩu hiện tại';
    const weak = passwordProblem(next);
    if (weak) found.next = weak;
    if (again !== next) found.again = 'Mật khẩu nhập lại không khớp';
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      await change.mutateAsync({ current, next });
      router.back();
    } catch (e) {
      setErrors({ current: errorMessage(e) });
    }
  }

  return (
    <>
      <StackHeader title="Đổi mật khẩu" />
      <Screen footer={<Button label="Lưu" loading={change.isPending} onPress={() => void submit()} />}>
        <PasswordField label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} error={errors.current} />
        <PasswordField label="Mật khẩu mới" value={next} onChangeText={setNext} error={errors.next} />
        {!errors.next ? <AppText variant="caption" color="muted">{PASSWORD_HINT}</AppText> : null}
        <PasswordField label="Nhập lại mật khẩu mới" value={again} onChangeText={setAgain} error={errors.again} />
      </Screen>
    </>
  );
}

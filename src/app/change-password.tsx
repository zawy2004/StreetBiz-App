import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { PasswordField } from '@/components/forms/PasswordField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

export default function ChangePasswordScreen() {
  const user = useAuthStore((s) => s.user);
  const updatePassword = useMockDb((s) => s.updateUserPassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; again?: string }>({});

  function submit() {
    const found: typeof errors = {};
    if (current !== user?.password) found.current = 'Mật khẩu hiện tại chưa đúng';
    if (next.length < 6) found.next = 'Mật khẩu cần ít nhất 6 ký tự';
    if (again !== next) found.again = 'Mật khẩu nhập lại không khớp';
    setErrors(found);
    if (Object.keys(found).length || !user) return;
    updatePassword(user.id, next);
    useAuthStore.setState({ user: { ...user, password: next } });
    router.back();
  }

  return (
    <>
      <StackHeader title="Đổi mật khẩu" />
      <Screen footer={<Button label="Lưu" onPress={submit} />}>
        <PasswordField label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} error={errors.current} />
        <PasswordField label="Mật khẩu mới" value={next} onChangeText={setNext} error={errors.next} />
        <PasswordField label="Nhập lại mật khẩu mới" value={again} onChangeText={setAgain} error={errors.again} />
      </Screen>
    </>
  );
}

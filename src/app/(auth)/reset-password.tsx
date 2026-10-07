import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { usePendingAuth } from '@/features/auth/pending-store';
import { useMockDb } from '@/mocks/db';
import { spacing, useTheme } from '@/theme';

function strength(password: string) {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (/\d/.test(password) && /[a-zA-Z]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH_LABEL = ['Quá ngắn', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'];

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const phone = usePendingAuth((s) => s.resetPhone);
  const setResetPhone = usePendingAuth((s) => s.setResetPhone);
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!phone) {
    return <Redirect href={'/(auth)/reset-request' as never} />;
  }

  const score = strength(next);

  function submit() {
    const found: Record<string, string> = {};
    if (code.replace(/\D/g, '').length !== 6) found.code = 'Mã gồm 6 số';
    if (next.length < 6) found.next = 'Mật khẩu cần ít nhất 6 ký tự';
    if (again !== next) found.again = 'Mật khẩu nhập lại không khớp';
    setErrors(found);
    if (Object.keys(found).length) return;

    const db = useMockDb.getState();
    const digits = (v: string) => v.replace(/\D/g, '');
    const user = db.users.find((u) => digits(u.phone) === digits(phone ?? ''));
    if (user) db.updateUserPassword(user.id, next);
    setResetPhone(null);
    router.replace('/(auth)/sign-in' as never);
  }

  return (
    <>
      <StackHeader title="Mật khẩu mới" />
      <Screen footer={<Button label="Đổi mật khẩu" onPress={submit} />}>
        <TextField
          label="Mã xác nhận"
          icon="message-text-outline"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          error={errors.code}
        />
        <PasswordField label="Mật khẩu mới" value={next} onChangeText={setNext} error={errors.next} />
        {next ? (
          <View style={styles.meter}>
            <View style={styles.bars}>
              {[1, 2, 3, 4].map((n) => (
                <View
                  key={n}
                  style={[styles.bar, { backgroundColor: n <= score ? (score <= 2 ? colors.secondary : colors.tertiary) : colors.border }]}
                />
              ))}
            </View>
            <AppText variant="small" color="muted">{STRENGTH_LABEL[score]}</AppText>
          </View>
        ) : null}
        <PasswordField label="Nhập lại mật khẩu" value={again} onChangeText={setAgain} error={errors.again} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  meter: { gap: spacing.xs },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
});

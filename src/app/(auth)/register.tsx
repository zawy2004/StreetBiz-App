import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Icon, type IconName } from '@/components/common/Icon';
import { CheckRow } from '@/components/forms/Choices';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { authApi, OTP_PURPOSE } from '@/core/api/auth-api';
import { errorMessage } from '@/core/api/problem';
import { RedirectIfSignedIn } from '@/core/auth/guards';
import { PASSWORD_HINT, passwordProblem } from '@/core/auth/password-policy';
import { isLiveApi } from '@/core/config/env';
import { phoneExists, type NewAccount } from '@/features/auth/create-account';
import { usePendingAuth } from '@/features/auth/pending-store';
import { radius, spacing, useTheme } from '@/theme';

type Role = NewAccount['role'];

const ROLES: { role: Role; label: string; hint: string; icon: IconName }[] = [
  { role: 'CUSTOMER', label: 'Người mua', hint: 'Tìm quán, đặt món', icon: 'shopping-outline' },
  { role: 'VENDOR', label: 'Hộ kinh doanh', hint: 'Thuê ô, mở gian hàng', icon: 'storefront-outline' },
];

export default function RegisterScreen() {
  return (
    <RedirectIfSignedIn>
      <Register />
    </RedirectIfSignedIn>
  );
}

function Register() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ role?: string }>();
  const setAccount = usePendingAuth((s) => s.setAccount);
  const [role, setRole] = useState<Role>(params.role === 'VENDOR' ? 'VENDOR' : 'CUSTOMER');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const found: Record<string, string> = {};
    if (!fullName.trim()) found.fullName = 'Nhập họ và tên';
    if (phone.replace(/\D/g, '').length !== 10) found.phone = 'Số điện thoại gồm 10 số';
    else if (!isLiveApi && phoneExists(phone)) found.phone = 'Số điện thoại đã có tài khoản';
    const weak = passwordProblem(password);
    if (weak) found.password = weak;
    if (again !== password) found.again = 'Mật khẩu nhập lại không khớp';
    if (!agreed) found.agreed = 'Cần đồng ý điều khoản';
    setErrors(found);
    if (Object.keys(found).length) return;

    const digits = phone.replace(/\D/g, '');
    if (isLiveApi) {
      // AUTH-02: the code goes out by SMS (the API console in Development).
      setBusy(true);
      try {
        await authApi.sendOtp(digits, OTP_PURPOSE.register);
      } catch (e) {
        setErrors({ phone: errorMessage(e) });
        return;
      } finally {
        setBusy(false);
      }
    }
    setAccount({ fullName: fullName.trim(), phone: digits, password, role });
    router.push('/(auth)/verify-phone' as never);
  }

  return (
    <>
      <StackHeader title="Tạo tài khoản" />
      <Screen footer={<Button label="Tạo tài khoản" loading={busy} onPress={() => void submit()} testID="register-submit" />}>
        <View style={styles.block}>
          <AppText variant="labelSm">Bạn là</AppText>
          <View style={styles.roles}>
            {ROLES.map((r) => {
              const selected = r.role === role;
              return (
                <Pressable
                  key={r.role}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setRole(r.role)}
                  style={[
                    styles.role,
                    {
                      backgroundColor: selected ? colors.primarySoft : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                >
                  <View style={[styles.roleIcon, { backgroundColor: selected ? colors.card : colors.indigoSoft }]}>
                    <Icon name={r.icon} size={26} color={selected ? 'primary' : 'indigo'} />
                  </View>
                  <AppText variant="label" color={selected ? 'primary' : 'text'}>{r.label}</AppText>
                  <AppText variant="caption" color="muted">{r.hint}</AppText>
                  {selected ? (
                    <View style={[styles.tick, { backgroundColor: colors.primary }]}>
                      <Icon name="check" size={14} color="onPrimary" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextField label="Họ và tên" icon="account-outline" value={fullName} onChangeText={setFullName} error={errors.fullName} />
        <TextField label="Số điện thoại" icon="phone-outline" keyboardType="phone-pad" value={phone} onChangeText={setPhone} error={errors.phone} />
        <PasswordField value={password} onChangeText={setPassword} error={errors.password} />
        {!errors.password ? <AppText variant="caption" color="muted">{PASSWORD_HINT}</AppText> : null}
        <PasswordField label="Nhập lại mật khẩu" value={again} onChangeText={setAgain} error={errors.again} />
        <View>
          <CheckRow label="Tôi đồng ý điều khoản sử dụng" checked={agreed} onToggle={() => setAgreed((a) => !a)} />
          {errors.agreed ? <AppText variant="small" color="error">{errors.agreed}</AppText> : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  roles: { flexDirection: 'row', gap: spacing.md },
  role: { flex: 1, minHeight: 132, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: 6, padding: spacing.md },
  roleIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tick: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});

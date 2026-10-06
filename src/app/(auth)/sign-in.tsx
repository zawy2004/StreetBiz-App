import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ROLE_HOME, useAuthStore } from '@/store/auth-store';
import { radius, spacing, useTheme } from '@/theme';

export default function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signIn);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();

  function submit() {
    if (signIn(phone, password) === 'invalid') {
      setError('Sai số điện thoại hoặc mật khẩu');
      return;
    }
    const role = useAuthStore.getState().user?.role_code;
    router.replace((role ? ROLE_HOME[role] : '/') as never);
  }

  return (
    <Screen>
      <View style={[styles.brand, { paddingTop: insets.top + spacing.xl }]}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Icon name="bank" size={44} color="onPrimary" />
        </View>
        <AppText variant="display">StreetBiz</AppText>
        <AppText color="muted">Vỉa hè Hải Châu 1</AppText>
      </View>

      <Card style={styles.form}>
        <TextField
          label="Số điện thoại"
          icon="phone-outline"
          placeholder="0905 000 001"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            setError(undefined);
          }}
        />
        <PasswordField
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(undefined);
          }}
          error={error}
        />
        <Link href={'/(auth)/reset-request' as never} style={styles.forgot}>
          <AppText variant="small" color="muted">Quên mật khẩu?</AppText>
        </Link>
        <Button label="Đăng nhập" onPress={submit} testID="sign-in-submit" />
      </Card>

      <View style={styles.or}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <AppText variant="small" color="muted">hoặc</AppText>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      <Button label="Tạo tài khoản" variant="outline" onPress={() => router.push('/(auth)/register' as never)} />
      <Link href={'/customer/explore' as never} style={styles.guest}>
        <AppText variant="label">Xem bản đồ không cần đăng nhập</AppText>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.sm },
  logo: { width: 80, height: 80, borderRadius: radius.chip + 4, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  form: { gap: spacing.lg },
  forgot: { alignSelf: 'flex-end' },
  or: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: 1 },
  guest: { alignSelf: 'center', textDecorationLine: 'underline', paddingVertical: spacing.md },
});

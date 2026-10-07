import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { HeroCard } from '@/components/common/HeroCard';
import { BrandMark } from '@/components/common/BrandMark';
import { Icon } from '@/components/common/Icon';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { errorMessage } from '@/core/api/problem';
import { RedirectIfSignedIn } from '@/core/auth/guards';
import { GUEST_HOME_ROUTE, landingFor } from '@/core/auth/role-routes';
import { goRoot, goTo } from '@/core/navigation/go';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, showDemoAccounts, type DemoAccount as Demo } from '@/features/auth/demo-accounts';
import { useAuthStore } from '@/store/auth-store';
import { accentTone, radius, spacing, useTheme } from '@/theme';

export default function SignInScreen() {
  return (
    <RedirectIfSignedIn>
      <SignIn />
    </RedirectIfSignedIn>
  );
}

function SignIn() {
  const { colors } = useTheme();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const signIn = useAuthStore((s) => s.signIn);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(withPhone = phone, withPassword = password) {
    if (!withPhone.trim() || !withPassword) {
      setError('Nhập số điện thoại và mật khẩu');
      return;
    }
    setBusy(true);
    try {
      const user = await signIn(withPhone, withPassword);
      goRoot(landingFor(user.role_code, next));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StackHeader title="Đăng nhập" />
      <Screen>
        <HeroCard>
          <BrandMark size={34} plate />
          <AppText variant="display" style={{ color: colors.onHero }}>Chào mừng trở lại</AppText>
          <AppText style={{ color: colors.heroMuted }}>
            {next ? 'Đăng nhập để tiếp tục việc bạn đang làm.' : 'Đăng nhập để đặt món, thuê ô và theo dõi giấy phép.'}
          </AppText>
        </HeroCard>

        <Card style={styles.form}>
          <TextField
            label="Số điện thoại"
            icon="phone-outline"
            placeholder="0905 000 001"
            keyboardType="phone-pad"
            autoComplete="tel"
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
            <AppText variant="labelSm" color="primary">Quên mật khẩu?</AppText>
          </Link>
          <Button label="Đăng nhập" icon="login" loading={busy} onPress={() => void submit()} testID="sign-in-submit" />
        </Card>

        {showDemoAccounts ? (
          <View style={styles.demo}>
            <AppText variant="labelSm" color="muted">Tài khoản demo · mật khẩu {DEMO_PASSWORD}</AppText>
            <View style={styles.demoRow}>
              {DEMO_ACCOUNTS.map((d) => (
                <DemoAccount
                  key={d.phone}
                  {...d}
                  onPress={() => {
                    setPhone(d.phone);
                    setPassword(DEMO_PASSWORD);
                    void submit(d.phone, DEMO_PASSWORD);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.or}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <AppText variant="small" color="muted">Chưa có tài khoản?</AppText>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>

        <Button label="Tạo tài khoản" variant="outline" icon="account-plus-outline" onPress={() => goTo('/(auth)/register')} />
        <Button label="Xem quán không cần đăng nhập" variant="ghost" onPress={() => goRoot(GUEST_HOME_ROUTE)} />
      </Screen>
    </>
  );
}

function DemoAccount({ label, phone, icon, tone, onPress }: Demo & { onPress: () => void }) {
  const { colors } = useTheme();
  const t = accentTone(colors, tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Đăng nhập demo: ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.demoCard, { backgroundColor: pressed ? colors.sunken : colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.demoIcon, { backgroundColor: t.bg }]}>
        <Icon name={icon} size={20} color={t.fg} />
      </View>
      <View style={styles.demoText}>
        <AppText variant="labelSm" numberOfLines={1}>{label}</AppText>
        <AppText variant="caption" color="muted">{phone}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  forgot: { alignSelf: 'flex-end' },
  demo: { gap: spacing.sm },
  demoRow: { flexDirection: 'row', gap: spacing.sm },
  demoCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderWidth: 1 },
  demoIcon: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  demoText: { flex: 1, minWidth: 0 },
  or: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: 1 },
});

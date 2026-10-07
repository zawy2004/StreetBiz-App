import { router } from 'expo-router';

import { goTo } from '@/core/navigation/go';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ListRow } from '@/components/common/ListRow';
import { Screen } from '@/components/layout/Screen';
import { ROLE_LABELS } from '@/core/types/role';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { useThemePrefs } from '@/store/theme-prefs';
import { radius, spacing, useTheme } from '@/theme';

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase();
}

export function AccountScreen() {
  const { colors, scheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setScheme = useThemePrefs((s) => s.setScheme);
  const unread = useMockDb((s) => s.notifications).filter((n) => n.userId === user?.id && !n.read).length;

  if (!user) return null;

  return (
    <Screen>
      <Card style={styles.profile}>
        <View style={[styles.avatar, { backgroundColor: colors.indigo }]}>
          <AppText variant="title" color="onIndigo">{initials(user.fullName)}</AppText>
        </View>
        <View style={styles.profileBody}>
          <AppText variant="title">{user.fullName}</AppText>
          <AppText variant="small" color="muted">{ROLE_LABELS[user.role_code]}</AppText>
          <AppText variant="body" color="muted">{user.phone}</AppText>
        </View>
      </Card>

      <Card padded={false}>
        <ListRow
          icon="bell-outline"
          title="Thông báo"
          trailing={unread ? <Badge count={unread} /> : undefined}
          onPress={() => goTo('/notifications')}
        />
        <ListRow icon="lock-reset" title="Đổi mật khẩu" onPress={() => goTo('/change-password')} />
        <ListRow icon="cellphone-link" title="Phiên đăng nhập" onPress={() => goTo('/sessions')} />
        <ListRow
          icon="weather-night"
          title="Giao diện tối"
          trailing={
            <Switch
              value={scheme === 'dark'}
              onValueChange={(on) => setScheme(on ? 'dark' : 'light')}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              accessibilityLabel="Giao diện tối"
            />
          }
        />
        {user.role_code === 'VENDOR' ? (
          <ListRow icon="robot-outline" title="Trợ lý" onPress={() => goTo('/vendor/assistant')} />
        ) : null}
        <ListRow icon="swap-horizontal" title="Đổi vai trò (demo)" onPress={() => goTo('/switch-role')} />
      </Card>

      <Button
        label="Đăng xuất"
        icon="logout"
        variant="danger"
        onPress={() => {
          signOut();
          router.replace('/(auth)/sign-in' as never);
        }}
      />
    </Screen>
  );
}

function Badge({ count }: { count: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
      <AppText variant="badge" color="onPrimary">{count}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center' },
  profileBody: { flex: 1, gap: 2 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});

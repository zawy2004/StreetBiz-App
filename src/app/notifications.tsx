import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing, useTheme } from '@/theme';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const items = useMockDb((s) => s.notifications).filter((n) => n.userId === user?.id);
  const markRead = useMockDb((s) => s.markNotificationRead);

  return (
    <>
      <StackHeader title="Thông báo" />
      <Screen>
        {items.length ? (
          <Card padded={false}>
            {items.map((n) => (
              <Card key={n.id} onPress={() => markRead(n.id)} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: n.read ? 'transparent' : colors.primary }]} />
                <View style={styles.body}>
                  <AppText variant="label">{n.title}</AppText>
                  <AppText variant="small" color="muted">{n.body}</AppText>
                </View>
              </Card>
            ))}
          </Card>
        ) : (
          <EmptyState icon="bell-outline" title="Chưa có thông báo" />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, borderWidth: 0, borderRadius: 0 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  body: { flex: 1, gap: 2 },
});

import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Icon, type IconName } from '@/components/common/Icon';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { HeaderIconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { RequireAuth } from '@/core/auth/guards';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/features/account/use-account';
import { accentTone, radius, spacing, useTheme, type AccentTone } from '@/theme';
import { formatDateTime } from '@/utils/format';

/** Icon per notification type; backend types are coarse (ORDER, FEE, …), the demo ones finer. */
function kindOf(type: string): { icon: IconName; tone: AccentTone } {
  const t = type.toUpperCase();
  if (t.includes('ORDER')) return { icon: 'receipt-text-outline', tone: 'primary' };
  if (t.includes('FEE') || t.includes('PAYMENT')) return { icon: 'cash-clock', tone: 'secondary' };
  if (t.includes('PENALT') || t.includes('VIOLATION')) return { icon: 'alert-outline', tone: 'error' };
  if (t.includes('REVIEW')) return { icon: 'star-outline', tone: 'secondary' };
  if (t.includes('CHAT') || t.includes('MESSAGE')) return { icon: 'message-text-outline', tone: 'indigo' };
  if (t.includes('REGISTRATION') || t.includes('PERMIT') || t.includes('CONTRACT')) return { icon: 'file-document-outline', tone: 'tertiary' };
  return { icon: 'bell-outline', tone: 'indigo' };
}

export default function NotificationsScreen() {
  return (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  );
}

function Notifications() {
  const { colors } = useTheme();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unreadIds = (notifications.data ?? []).filter((n) => !n.read).map((n) => n.id);

  return (
    <>
      <StackHeader
        title="Thông báo"
        right={unreadIds.length ? <HeaderIconButton icon="check-all" label="Đánh dấu tất cả đã đọc" onPress={() => markAll.mutate(unreadIds)} /> : undefined}
      />
      <Screen onRefresh={notifications.refetch} refreshing={notifications.isRefetching}>
        <QueryView query={notifications}>
          {(items) =>
            items.length ? (
              <Card padded={false}>
                {items.map((n, i) => {
                  const kind = kindOf(n.type);
                  const tone = accentTone(colors, kind.tone);
                  return (
                    <Pressable
                      key={n.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: !n.read }}
                      onPress={() => (n.read ? undefined : markRead.mutate(n.id))}
                      style={({ pressed }) => [
                        styles.row,
                        { borderBottomColor: i === items.length - 1 ? 'transparent' : colors.border },
                        pressed ? { backgroundColor: colors.sunken } : null,
                      ]}
                    >
                      <View style={[styles.icon, { backgroundColor: tone.bg }]}>
                        <Icon name={kind.icon} size={20} color={tone.fg} />
                      </View>
                      <View style={styles.body}>
                        <AppText variant={n.read ? 'body' : 'label'}>{n.title}</AppText>
                        <AppText variant="small" color="muted">{n.body}</AppText>
                        <AppText variant="caption" color="muted">{formatDateTime(n.sentAt)}</AppText>
                      </View>
                      {n.read ? null : <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
                    </Pressable>
                  );
                })}
              </Card>
            ) : (
              <EmptyState icon="bell-outline" title="Chưa có thông báo" description="Cập nhật về đơn hàng, phí và hồ sơ sẽ hiện ở đây." />
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});

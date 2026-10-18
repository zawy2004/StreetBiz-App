import { router, Stack, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StateView } from '@/components/feedback/StateView';
import { Screen } from '@/components/layout/Screen';
import { errorMessage } from '@/core/api';
import { relativeTime } from '@/features/account-management/account-format';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, statusTones, text } from '@/theme';
import {
  notificationTarget,
  notificationVisual,
  splitByRecency,
  type NotificationTone,
} from './notification-routing';
import { useNotifications, type NotificationItem } from './notifications-api';

const TONE: Record<NotificationTone, { wash: string; ink: string }> = {
  primary: { wash: colors.brandTint, ink: colors.primary },
  success: { wash: statusTones.ok.wash, ink: statusTones.ok.ink },
  warning: { wash: statusTones.pending.wash, ink: statusTones.pending.ink },
  error: { wash: statusTones.danger.wash, ink: statusTones.danger.ink },
  neutral: { wash: colors.sunken, ink: '#2B3640' },
};

function Row({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const v = notificationVisual(item);
  const t = TONE[v.tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? '' : 'Chưa đọc. '}${item.title}. ${item.body}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 12,
        padding: 14,
        backgroundColor: pressed ? colors.pressed : item.read ? colors.card : '#FFF7F2',
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: t.wash,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sf={v.icon.sf} md={v.icon.md} size={19} color={t.ink} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={2}
            style={{ flex: 1, fontFamily: item.read ? fonts.semibold : fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }}
          >
            {item.title}
          </Text>
          {item.read ? null : <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.cta }} />}
        </View>
        <Text style={[text.subhead, { fontFamily: fonts.regular, color: '#2B3640' }]} numberOfLines={3}>
          {item.body}
        </Text>
        <Text style={[text.caption, { color: colors.muted, fontFamily: fonts.regular }]}>{relativeTime(item.sentAt)}</Text>
      </View>
    </Pressable>
  );
}

/**
 * SH02 Thông báo (the web's bell, as a screen on a phone): the newest 50, unread first in a
 * warm tint, "Mới" for the last day; a tap marks it read and opens what it is about.
 */
export function NotificationsScreen() {
  const role = useAuthStore((s) => s.user?.role_code);
  const n = useNotifications();
  const { recent, earlier } = splitByRecency(n.items);
  const unread = n.items.filter((i) => !i.read).length;

  const open = (item: NotificationItem) => {
    if (!item.read) n.markRead(item.id);
    const target = notificationTarget(item, role);
    if (target) router.push(target as Href);
  };

  const group = (title: string, items: NotificationItem[]) =>
    items.length ? (
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginLeft: 4 }}>{title}</Text>
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card }}>
          {items.map((item, i) => (
            <View key={item.id}>
              <Row item={item} onPress={() => open(item)} />
              {i < items.length - 1 ? (
                <View style={{ position: 'absolute', left: 66, right: 0, bottom: 0, height: 1, backgroundColor: colors.separator }} />
              ) : null}
            </View>
          ))}
        </View>
      </View>
    ) : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Thông báo',
          headerRight: () =>
            unread > 0 ? (
              <Pressable onPress={n.markAllRead} hitSlop={10} accessibilityRole="button">
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.primary }}>Đọc hết</Text>
              </Pressable>
            ) : null,
        }}
      />
      <Screen onRefresh={n.refetch} refreshing={false}>
        {n.isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} height={84} radius={radius.card} />)
        ) : n.isError ? (
          <StateView
            tone="danger"
            icon={{ sf: 'wifi.exclamationmark', md: 'wifi_off' }}
            title="Không tải được thông báo"
            body={errorMessage(n.error)}
            action={{ label: 'Thử lại', onPress: n.refetch }}
          />
        ) : n.items.length === 0 ? (
          <StateView
            icon={{ sf: 'bell', md: 'notifications' }}
            title="Chưa có thông báo"
            body="Đơn hàng, phí, giấy phép và kết quả duyệt hồ sơ sẽ báo ở đây."
          />
        ) : (
          <>
            {group('Mới', recent)}
            {group('Trước đó', earlier)}
          </>
        )}
      </Screen>
    </>
  );
}

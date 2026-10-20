import { router, Stack, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StateView } from '@/components/feedback/StateView';
import { Screen } from '@/components/layout/Screen';
import { errorMessage } from '@/core/api';
import { relativeTime } from '@/features/account-management/account-format';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, statusTones, tabular, text } from '@/theme';
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

/** One notice: a round disc in its tone, the title, the body, when. Unread wears an orange edge and dot. */
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
        paddingVertical: 14,
        paddingLeft: 16,
        paddingRight: 14,
        backgroundColor: pressed ? colors.pressed : item.read ? colors.card : colors.kerbPaint,
      })}
    >
      {item.read ? null : <View style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderTopRightRadius: radius.plate, borderBottomRightRadius: radius.plate, backgroundColor: colors.cta }} />}
      <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: t.wash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={v.icon.sf} md={v.icon.md} size={20} color={t.ink} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text
            numberOfLines={2}
            style={{ flex: 1, fontFamily: item.read ? fonts.semibold : fonts.heavy, fontSize: 15.5, lineHeight: 21, color: colors.ink }}
          >
            {item.title}
          </Text>
          {item.read ? null : <View style={{ width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.cta, marginTop: 6 }} />}
        </View>
        <Text style={[text.subhead, { fontFamily: fonts.regular, color: '#2B3640' }]} numberOfLines={3}>
          {item.body}
        </Text>
        <Text style={[text.caption, { color: item.read ? colors.muted : colors.primary }]}>{relativeTime(item.sentAt)}</Text>
      </View>
    </Pressable>
  );
}

/**
 * SH02 Thông báo (the web's bell, as a screen on a phone; screens/v5/shared-admin.md): how many
 * are unread in a sign-lettered figure, then "Mới" and "Trước đó"; unread rows wear an orange edge.
 * A tap marks it read and opens what it is about.
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
      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink, marginLeft: 4 }}>{title}</Text>
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
          {items.map((item, i) => (
            <View key={item.id}>
              <Row item={item} onPress={() => open(item)} />
              {i < items.length - 1 ? (
                <View style={{ position: 'absolute', left: 72, right: 0, bottom: 0, height: 1, backgroundColor: colors.separator }} />
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
              <Pressable onPress={n.markAllRead} hitSlop={10} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.primary }}>Đọc hết</Text>
              </Pressable>
            ) : null,
        }}
      />
      <Screen gap={22} onRefresh={n.refetch} refreshing={false}>
        {n.isLoading ? (
          <>
            <Skeleton width={200} height={56} radius={radius.control} />
            <View style={{ gap: 1, borderRadius: radius.card, overflow: 'hidden' }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={92} radius={0} />
              ))}
            </View>
          </>
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
            {/* The count of what is new, in sign lettering */}
            <View accessible accessibilityLabel={unread > 0 ? `${unread} thông báo chưa đọc` : 'Đã đọc hết thông báo'} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 }}>
              {unread > 0 ? (
                <>
                  <Text maxFontSizeMultiplier={1.3} style={[sign.figure, { color: colors.primary }, tabular]}>{unread}</Text>
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }}>{`thông báo chưa đọc\ntrong ${n.items.length} thông báo gần nhất`}</Text>
                </>
              ) : (
                <>
                  <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.leafTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf="checkmark" md="check" size={20} color={colors.leaf} weight="bold" />
                  </View>
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>Bạn đã đọc hết thông báo</Text>
                </>
              )}
            </View>
            {group('Mới', recent)}
            {group('Trước đó', earlier)}
          </>
        )}
      </Screen>
    </>
  );
}

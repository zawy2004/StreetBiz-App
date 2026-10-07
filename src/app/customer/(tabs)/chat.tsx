import dayjs from 'dayjs';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { requireAuth } from '@/core/auth/require-auth';
import { goTo } from '@/core/navigation/go';
import { useChat } from '@/features/chat/chat-store';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { radius, spacing, useTheme } from '@/theme';

export default function ConversationsScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const conversations = useChat((s) => s.conversations).filter((c) => c.messages.length);
  const stores = useMockDb((s) => s.storefronts);

  if (!user) {
    return (
      <Screen>
        <EmptyState icon="account-lock-outline" title="Đăng nhập để nhắn tin" />
        <Button label="Đăng nhập" onPress={() => requireAuth()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {conversations.length ? (
        conversations.map((c) => {
          const last = c.messages[c.messages.length - 1];
          return (
            <Card key={c.storefrontId} onPress={() => goTo(`/customer/chat/${c.storefrontId}`)} style={styles.row}>
              <Thumb size={48} rounded />
              <View style={styles.body}>
                <AppText variant={c.unread ? 'label' : 'body'}>{stores.find((s) => s.id === c.storefrontId)?.name}</AppText>
                <AppText variant="small" color="muted" numberOfLines={1}>{last?.text}</AppText>
              </View>
              <View style={styles.meta}>
                <AppText variant="small" color="muted">{last ? dayjs(last.at).format('HH:mm') : ''}</AppText>
                {c.unread ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <AppText variant="badge" color="onPrimary">{c.unread}</AppText>
                  </View>
                ) : null}
              </View>
            </Card>
          );
        })
      ) : (
        <EmptyState icon="message-outline" title="Chưa có tin nhắn" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: 2 },
  meta: { alignItems: 'flex-end', gap: spacing.xs },
  badge: { minWidth: 22, height: 22, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});

import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Avatar } from '@/components/common/Avatar';
import { Card } from '@/components/common/Card';
import { Thumb } from '@/components/common/Thumb';
import { radius, spacing, useTheme } from '@/theme';
import { formatTime } from '@/utils/format';

import type { ChatSide } from './chat-store';
import type { ThreadSummary } from './use-chat';

export function ConversationRow({ thread, me, onPress }: { thread: ThreadSummary; me: ChatSide; onPress: () => void }) {
  const { colors } = useTheme();
  const unread = thread.unread;
  const preview = thread.preview ? `${thread.lastFromMe ? 'Bạn: ' : ''}${thread.preview}` : 'Chưa có tin nhắn';

  return (
    <Card onPress={onPress} style={styles.row}>
      {me === 'CUSTOMER' ? <Thumb size={50} rounded seed={thread.storefrontId} icon="storefront-outline" /> : <Avatar name={thread.title} size={50} />}
      <View style={styles.body}>
        <AppText variant={unread ? 'label' : 'body'} numberOfLines={1}>{thread.title}</AppText>
        <AppText variant="small" color={unread ? 'text' : 'muted'} numberOfLines={1}>{preview}</AppText>
      </View>
      <View style={styles.meta}>
        <AppText variant="caption" color={unread ? 'primary' : 'muted'}>{thread.lastAt ? formatTime(thread.lastAt) : ''}</AppText>
        {unread ? (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <AppText variant="badge" color="onPrimary">{unread}</AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  body: { flex: 1, gap: 2, minWidth: 0 },
  meta: { alignItems: 'flex-end', gap: spacing.xs },
  badge: { minWidth: 22, height: 22, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});

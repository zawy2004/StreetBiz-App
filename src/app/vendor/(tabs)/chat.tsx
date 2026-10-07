import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { goTo } from '@/core/navigation/go';
import { ConversationRow } from '@/features/chat/ConversationRow';
import { useConversations } from '@/features/chat/use-chat';

/** Seller inbox: buyers who messaged this vendor's storefronts (FE: /vendor/chat). */
export default function VendorConversationsScreen() {
  const conversations = useConversations('VENDOR');

  return (
    <Screen onRefresh={conversations.refetch} refreshing={conversations.isRefetching}>
      <QueryView query={conversations}>
        {(threads) =>
          threads.length ? (
            threads.map((t) => <ConversationRow key={t.key} thread={t} me="VENDOR" onPress={() => goTo(`/vendor/chat/${t.key}`)} />)
          ) : (
            <EmptyState icon="message-text-outline" tone="primary" title="Chưa có tin nhắn" description="Người mua nhắn tới gian hàng sẽ hiện ở đây." />
          )
        }
      </QueryView>
    </Screen>
  );
}

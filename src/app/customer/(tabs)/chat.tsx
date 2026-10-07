import { Button } from '@/components/common/Button';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { goTo } from '@/core/navigation/go';
import { ConversationRow } from '@/features/chat/ConversationRow';
import { useConversations } from '@/features/chat/use-chat';

export default function ConversationsScreen() {
  const conversations = useConversations('CUSTOMER');

  return (
    <Screen onRefresh={conversations.refetch} refreshing={conversations.isRefetching}>
      <QueryView query={conversations}>
        {(threads) =>
          threads.length ? (
            threads.map((t) => <ConversationRow key={t.key} thread={t} me="CUSTOMER" onPress={() => goTo(`/customer/chat/${t.key}`)} />)
          ) : (
            <EmptyState icon="message-text-outline" tone="primary" title="Chưa có tin nhắn" description="Nhắn cho quán từ trang gian hàng để hỏi món hoặc giờ lấy.">
              <Button label="Khám phá quán" variant="soft" onPress={() => goTo('/customer/explore')} />
            </EmptyState>
          )
        }
      </QueryView>
    </Screen>
  );
}

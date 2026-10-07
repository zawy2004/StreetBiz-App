import { useLocalSearchParams } from 'expo-router';

import { QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ChatThreadView } from '@/features/chat/ChatThreadView';
import { useThread } from '@/features/chat/use-chat';

const QUICK_REPLIES = ['Quán còn mở không ạ?', 'Mấy phút nữa xong ạ?', 'Mình tới lấy rồi'];

/** Buyer side of a conversation with one storefront (`id` = storefront id; the layout keeps guests out). */
export default function ChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const thread = useThread('CUSTOMER', id);

  return (
    <>
      <StackHeader title={thread.data?.title ?? 'Tin nhắn'} />
      {thread.data ? (
        <ChatThreadView messages={thread.data.messages} onSend={thread.send} sending={thread.sending} quickReplies={QUICK_REPLIES} />
      ) : (
        <Screen>
          <QueryView query={thread}>{() => null}</QueryView>
        </Screen>
      )}
    </>
  );
}

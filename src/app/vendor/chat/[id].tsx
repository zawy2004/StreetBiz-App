import { useLocalSearchParams } from 'expo-router';

import { QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ChatThreadView } from '@/features/chat/ChatThreadView';
import { useThread } from '@/features/chat/use-chat';

const QUICK_REPLIES = ['Dạ còn ạ', 'Khoảng 10 phút nữa xong ạ', 'Đơn đã sẵn sàng, mời bạn tới lấy'];

/** Seller side of a conversation; `id` is the conversation (live) or the buyer's id (demo). */
export default function VendorChatThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const thread = useThread('VENDOR', id);

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

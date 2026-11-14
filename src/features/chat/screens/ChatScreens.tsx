import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/common/Avatar';
import { Segments } from '@/components/common/Blocks';
import { Icon } from '@/components/common/Icon';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { errorMessage } from '@/core/api';
import { assetUrl } from '@/core/api/asset-url';
import { isLiveApi } from '@/core/config/env';
import { useNow } from '@/features/sidewalk-slots/useNow';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, space, tabular, text } from '@/theme';
import { conversationTimestamp, layoutThread, messageTime, type ThreadItem } from '../chat-format';
import { useCanChat, useChatConversations, useChatMessages, useSendChatMessage } from '../hooks/useChat';
import { CHAT_MESSAGE_MAX_LENGTH, type ChatConversation } from '../types/chat.types';

const go = (href: string) => router.push(href as Href);

/** A thread opens above the tabs for both roles, so back returns to wherever it was opened from. */
export const threadPath = (conversationId: number) => `/chat/${conversationId}`;

/** The stall's sign: its photo when it has one, else the initials on a soft colour. */
function CounterpartAvatar({ conversation, role, size = 48 }: { conversation: ChatConversation; role: string | undefined; size?: number }) {
  // A buyer talks to a stall (photo); a seller talks to a person (initials).
  const uri = role === 'CUSTOMER' ? assetUrl(conversation.storefrontImageUrl) : undefined;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.sunken }}
        contentFit="cover"
        transition={120}
      />
    );
  }
  return <Avatar name={conversation.counterpartName || conversation.storefrontName} size={size} />;
}

function matches(conversation: ChatConversation, query: string) {
  const q = query.trim().toLocaleLowerCase('vi');
  if (!q) return true;
  return [conversation.counterpartName, conversation.storefrontName]
    .filter(Boolean)
    .some((name) => name.toLocaleLowerCase('vi').includes(q));
}

type Filter = 'all' | 'unread';

/**
 * Tin nhắn (screens/v5/shared-admin.md): the inbox, the same screen for buyers and sellers, newest
 * thread first. What waits is painted as a figure on the street orange; the threads join into one
 * white card, unread ones on warm paper with an orange dot on the avatar.
 */
export function ConversationsScreen() {
  const role = useAuthStore((s) => s.user?.role_code);
  const canChat = useCanChat();
  const conversations = useChatConversations();
  const now = useNow(60_000);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const vendor = role === 'VENDOR';

  if (!canChat) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.md }}>
        <Stack.Screen options={{ title: 'Tin nhắn' }} />
        {role || !isLiveApi ? (
          <StateView icon={{ sf: 'bubble.left.and.bubble.right', md: 'chat' }} tone="neutral" title="Chưa nối máy chủ" body="Tin nhắn chỉ chạy khi ứng dụng nối với máy chủ StreetBiz." />
        ) : (
          <StateView
            icon={{ sf: 'bubble.left.and.bubble.right', md: 'chat' }}
            title="Đăng nhập để nhắn tin"
            body="Hỏi quán còn món không, hẹn giờ lấy, hay nhờ để phần — tất cả ở đây."
            action={{ label: 'Đăng nhập', onPress: () => go('/auth/sign-in') }}
          />
        )}
      </View>
    );
  }

  const rows = conversations.data ?? [];
  const unreadTotal = rows.reduce((sum, row) => sum + row.unreadCount, 0);
  const unreadThreads = rows.filter((r) => r.unreadCount > 0).length;
  const shown = rows.filter((row) => (filter === 'all' || row.unreadCount > 0) && matches(row, query));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Tin nhắn' }} />
      <FlatList
        data={shown}
        keyExtractor={(c) => String(c.conversationId)}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: space.md, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={conversations.isRefetching} onRefresh={() => void conversations.refetch()} tintColor={colors.cta} colors={[colors.cta]} />
        }
        ListHeaderComponent={
          rows.length > 0 ? (
            <View style={{ gap: 12, marginBottom: 14 }}>
              {unreadTotal > 0 ? (
                // What waits, in sign lettering on the street orange
                <View
                  accessible
                  accessibilityLabel={`${unreadTotal} tin chưa đọc trong ${unreadThreads} cuộc trò chuyện`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.cta, boxShadow: shadow.glow }}
                >
                  <Text maxFontSizeMultiplier={1.3} style={[sign.figure, { color: colors.white }, tabular]}>
                    {unreadTotal > 99 ? '99+' : unreadTotal}
                  </Text>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.white }}>tin chưa đọc</Text>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.white }}>{`trong ${unreadThreads} cuộc trò chuyện`}</Text>
                  </View>
                  <Icon sf="envelope.badge.fill" md="mark_chat_unread" size={26} color={colors.white} />
                </View>
              ) : null}
              {rows.length >= 3 ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: colors.card, boxShadow: shadow.card }}>
                    <Icon sf="magnifyingglass" md="search" size={18} color={colors.primary} />
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder={vendor ? 'Tìm theo tên khách' : 'Tìm theo tên quán'}
                      placeholderTextColor={colors.muted}
                      accessibilityLabel="Tìm cuộc trò chuyện"
                      returnKeyType="search"
                      selectionColor={colors.cta}
                      cursorColor={colors.cta}
                      style={{ flex: 1, minHeight: 46, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, paddingVertical: 0 }}
                    />
                    {query ? (
                      <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Xoá tìm kiếm" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon sf="xmark.circle.fill" md="cancel" size={18} color={colors.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Segments<Filter>
                    value={filter}
                    onChange={setFilter}
                    options={[
                      { key: 'all', label: 'Tất cả' },
                      { key: 'unread', label: 'Chưa đọc', count: unreadThreads },
                    ]}
                  />
                </>
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          conversations.isPending ? (
            <ListSkeleton rows={5} height={76} />
          ) : conversations.isError ? (
            <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} />
          ) : rows.length > 0 ? (
            <StateView icon={{ sf: 'magnifyingglass', md: 'search_off' }} tone="neutral" title="Không có cuộc trò chuyện khớp" body={filter === 'unread' ? 'Bạn đã đọc hết tin nhắn.' : 'Thử tên khác.'} />
          ) : (
            <StateView
              icon={{ sf: 'bubble.left.and.bubble.right', md: 'chat' }}
              title="Chưa có cuộc trò chuyện"
              body={vendor ? 'Khi khách nhắn tin cho gian hàng của bạn, cuộc trò chuyện sẽ hiện ở đây.' : 'Mở một quán và bấm “Nhắn tin” để hỏi người bán.'}
              action={vendor ? undefined : { label: 'Khám phá quán', onPress: () => go('/customer/explore') }}
            />
          )
        }
        renderItem={({ item, index }) => (
          <ConversationRow
            conversation={item}
            role={role}
            now={now}
            first={index === 0}
            last={index === shown.length - 1}
            onPress={() => go(threadPath(item.conversationId))}
          />
        )}
      />
    </View>
  );
}

/** One conversation: rows join into a single white card (the first and last carry its corners). */
function ConversationRow({
  conversation: c,
  role,
  now,
  first,
  last,
  onPress,
}: {
  conversation: ChatConversation;
  role: string | undefined;
  now: number;
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const unread = c.unreadCount > 0;
  const preview = c.lastMessagePreview ? `${c.lastMessageFromMe ? 'Bạn: ' : ''}${c.lastMessagePreview}` : 'Chưa có tin nhắn';
  const when = conversationTimestamp(c.lastMessageAt ?? c.createdAt, now);
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderTopLeftRadius: first ? radius.card : 0,
        borderTopRightRadius: first ? radius.card : 0,
        borderBottomLeftRadius: last ? radius.card : 0,
        borderBottomRightRadius: last ? radius.card : 0,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${c.counterpartName}${unread ? `, ${c.unreadCount} tin chưa đọc` : ''}. ${preview}. ${when}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 76,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: pressed ? colors.pressed : unread ? colors.kerbPaint : colors.card,
        })}
      >
        <View>
          <CounterpartAvatar conversation={c} role={role} size={52} />
          {unread ? (
            <View style={{ position: 'absolute', right: -1, bottom: -1, width: 16, height: 16, borderRadius: radius.full, backgroundColor: colors.cta, borderWidth: 3, borderColor: colors.white }} />
          ) : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: unread ? fonts.heavy : fonts.semibold, fontSize: 16, color: colors.ink }}>
              {c.counterpartName}
            </Text>
            <Text style={[text.caption, tabular, { color: unread ? colors.primary : colors.muted }]}>{when}</Text>
          </View>
          {role === 'VENDOR' && c.storefrontName ? (
            <Text numberOfLines={1} style={[text.caption, { color: colors.muted }]}>{c.storefrontName}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={[text.footnote, { flex: 1, color: unread ? colors.ink : colors.muted, fontFamily: unread ? fonts.semibold : fonts.regular }]}>
              {preview}
            </Text>
            {unread ? (
              <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: radius.full, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[{ fontFamily: fonts.heavy, fontSize: 12, color: colors.white }, tabular]}>{c.unreadCount > 99 ? '99+' : c.unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
      {last ? null : <View style={{ position: 'absolute', left: 80, right: 0, bottom: 0, height: 1, backgroundColor: colors.separator }} />}
    </View>
  );
}

/** One thread: newest at the bottom, older pages load as you scroll up, the composer on the counter. */
export function ChatThreadScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const role = useAuthStore((s) => s.user?.role_code);
  const canChat = useCanChat();
  const headerHeight = useHeaderHeight();
  const now = useNow(60_000);
  const { thread, messages, hasMore, loadOlder, loadingOlder, olderError } = useChatMessages(conversationId);
  const send = useSendChatMessage(conversationId);

  if (!canChat) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.md }}>
        <Stack.Screen options={{ title: 'Tin nhắn' }} />
        <StateView icon={{ sf: 'bubble.left.and.bubble.right', md: 'chat' }} tone="neutral" title="Không mở được cuộc trò chuyện" body="Đăng nhập bằng tài khoản người mua hoặc người bán để nhắn tin." />
      </View>
    );
  }
  if (thread.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.md }}>
        <Stack.Screen options={{ title: '' }} />
        <ListSkeleton rows={6} height={52} />
      </View>
    );
  }
  if (thread.isError || !thread.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.md }}>
        <Stack.Screen options={{ title: 'Tin nhắn' }} />
        <ErrorState error={thread.error ?? new Error('Không tìm thấy cuộc trò chuyện.')} onRetry={() => void thread.refetch()} />
      </View>
    );
  }

  const conversation = thread.data.conversation;
  // Inverted: the newest message sits at the bottom and the list starts there.
  const items = layoutThread(messages, now).reverse();

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: conversation.counterpartName,
          headerTitle: () => <ThreadTitle conversation={conversation} role={role} />,
          headerRight:
            role === 'CUSTOMER'
              ? () => (
                  <Pressable
                    onPress={() => go(`/customer/explore/stores/${conversation.storefrontId}`)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Xem quán ${conversation.storefrontName}`}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? '#FFD3BA' : colors.brandTint })}
                  >
                    <Icon sf="storefront.fill" md="storefront" size={20} color={colors.primary} />
                  </Pressable>
                )
              : undefined,
        }}
      />
      <FlatList
        // Inverted only with messages: an inverted list also turns its empty state round.
        inverted={items.length > 0}
        data={items}
        keyExtractor={(item) => String(item.message.messageId)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingHorizontal: space.md, paddingVertical: 12, flexGrow: 1 }}
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (hasMore) loadOlder();
        }}
        accessibilityLabel="Tin nhắn"
        renderItem={({ item }) => <MessageRow item={item} />}
        // Inverted: the "footer" is drawn at the top, above the oldest message.
        ListFooterComponent={
          loadingOlder ? (
            <ActivityIndicator color={colors.cta} style={{ paddingVertical: 12 }} />
          ) : olderError ? (
            <Text style={[text.footnote, { color: colors.onDanger, textAlign: 'center', paddingVertical: 10 }]}>{errorMessage(olderError)}</Text>
          ) : hasMore ? (
            <Pressable onPress={loadOlder} accessibilityRole="button" hitSlop={6} style={({ pressed }) => ({ alignSelf: 'center', marginVertical: 10, paddingHorizontal: 16, minHeight: 36, borderRadius: radius.full, justifyContent: 'center', backgroundColor: pressed ? colors.brandTint : colors.card, boxShadow: shadow.card })}>
              <Text style={[text.caption, { color: colors.ink }]}>Xem tin cũ hơn</Text>
            </Pressable>
          ) : messages.length > 0 ? (
            <ThreadStart conversation={conversation} role={role} />
          ) : null
        }
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <StateView
              icon={{ sf: 'hand.wave', md: 'waving_hand' }}
              title="Chưa có tin nhắn"
              body={role === 'CUSTOMER' ? 'Chào quán một câu, hỏi món hay hẹn giờ lấy.' : 'Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện.'}
            />
          </View>
        }
      />
      <Composer
        starters={role === 'CUSTOMER' && items.length === 0 ? CUSTOMER_STARTERS : undefined}
        sending={send.isPending}
        error={send.isError ? errorMessage(send.error) : undefined}
        onSend={async (body) => {
          await send.mutateAsync(body);
          void Haptics.selectionAsync();
        }}
      />
    </KeyboardAvoidingView>
  );
}

function ThreadTitle({ conversation, role }: { conversation: ChatConversation; role: string | undefined }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 240 }} accessibilityRole="header">
      <CounterpartAvatar conversation={conversation} role={role} size={36} />
      <View style={{ flexShrink: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>{conversation.counterpartName}</Text>
        {role === 'VENDOR' && conversation.storefrontName ? (
          <Text numberOfLines={1} style={[text.caption, { color: colors.muted }]}>{conversation.storefrontName}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Above the oldest message once the whole history is loaded. */
function ThreadStart({ conversation, role }: { conversation: ChatConversation; role: string | undefined }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingTop: 8, paddingBottom: 18 }}>
      <View style={{ padding: 3, borderRadius: radius.full, backgroundColor: colors.brandTint }}>
        <CounterpartAvatar conversation={conversation} role={role} size={60} />
      </View>
      <Text style={[text.title3, { color: colors.ink, fontFamily: fonts.heavy, textAlign: 'center' }]}>{conversation.counterpartName}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.sunken }}>
        <Icon sf="lock.fill" md="lock" size={12} color={colors.muted} />
        <Text style={[text.caption, { color: colors.muted, textAlign: 'center', flexShrink: 1 }]}>
          {role === 'CUSTOMER' ? 'Tin nhắn chỉ giữa bạn và quán.' : 'Tin nhắn chỉ giữa gian hàng và khách này.'}
        </Text>
      </View>
    </View>
  );
}

/** A bubble: mine solid street orange on the right, theirs white paper on the left; a run of them shares corners. */
function MessageRow({ item }: { item: ThreadItem }) {
  const { message: m, dayBreak, joinsPrevious, joinsNext } = item;
  const mine = m.fromMe;
  const big = radius.card;
  const small = radius.plate;
  const time = messageTime(m.sentAt);
  const receipt = mine ? (m.readAt ? 'Đã xem' : 'Đã gửi') : '';
  return (
    <View style={{ gap: 4, paddingTop: joinsPrevious ? 2 : 10 }}>
      {dayBreak ? (
        <View style={{ alignSelf: 'center', marginVertical: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.card, boxShadow: shadow.card }}>
          <Text style={[text.caption, { color: colors.ink }]}>{dayBreak}</Text>
        </View>
      ) : null}
      <View
        accessible
        accessibilityLabel={`${mine ? 'Bạn' : m.senderName}: ${m.body}. ${time}${receipt ? `, ${receipt}` : ''}`}
        style={{
          alignSelf: mine ? 'flex-end' : 'flex-start',
          maxWidth: '82%',
          paddingHorizontal: 15,
          paddingVertical: 10,
          backgroundColor: mine ? colors.cta : colors.card,
          borderWidth: mine ? 0 : 1,
          borderColor: colors.line,
          borderCurve: 'continuous',
          borderTopLeftRadius: !mine && joinsPrevious ? small : big,
          borderBottomLeftRadius: !mine && joinsNext ? small : big,
          borderTopRightRadius: mine && joinsPrevious ? small : big,
          borderBottomRightRadius: mine && joinsNext ? small : big,
        }}
      >
        <Text selectable style={{ fontFamily: mine ? fonts.medium : fonts.regular, fontSize: 16, lineHeight: 22, color: mine ? colors.white : colors.ink }}>
          {m.body}
        </Text>
      </View>
      {!joinsNext ? (
        <Text style={[text.caption, tabular, { color: colors.muted, alignSelf: mine ? 'flex-end' : 'flex-start', paddingHorizontal: 6 }]}>
          {receipt ? `${time}, ${receipt}` : time}
        </Text>
      ) : null}
    </View>
  );
}

/** Start counting characters once this few are left before the limit. */
const COUNT_FROM = 200;

/** Opening lines a buyer can drop into the composer of an empty thread (fills the box, never sends). */
const CUSTOMER_STARTERS = ['Quán còn món không ạ?', 'Mấy giờ quán mở cửa?', 'Để phần giúp mình nhé.'];

function Composer({
  sending,
  error,
  onSend,
  starters,
}: {
  sending: boolean;
  error?: string;
  onSend: (body: string) => Promise<unknown>;
  starters?: string[];
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const body = draft.trim();
  const canSend = Boolean(body) && !sending;
  const remaining = CHAT_MESSAGE_MAX_LENGTH - draft.length;

  const submit = async () => {
    if (!canSend) return;
    try {
      await onSend(body);
      setDraft('');
    } catch {
      // Keep what was typed: the error below says to try again.
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderTopLeftRadius: radius.card,
        borderTopRightRadius: radius.card,
        borderCurve: 'continuous',
        boxShadow: '0 -10px 28px -14px rgba(17, 28, 43, 0.22)',
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 10),
        gap: 8,
      }}
    >
      {starters && !draft ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
          {starters.map((q) => (
            <Pressable
              key={q}
              onPress={() => setDraft(q)}
              accessibilityRole="button"
              accessibilityLabel={`Điền câu: ${q}`}
              style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.full, justifyContent: 'center', backgroundColor: pressed ? '#FFD3BA' : colors.brandTint })}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.primary }}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Nhập tin nhắn…"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          accessibilityLabel="Nội dung tin nhắn"
          selectionColor={colors.cta}
          cursorColor={colors.cta}
          style={{
            flex: 1,
            minHeight: 46,
            maxHeight: 132,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: colors.sunken,
            fontFamily: fonts.regular,
            fontSize: 16,
            lineHeight: 21,
            color: colors.ink,
            textAlignVertical: 'center',
          }}
        />
        <Pressable
          onPress={() => void submit()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Gửi"
          accessibilityState={{ disabled: !canSend, busy: sending }}
          style={({ pressed }) => ({
            width: 46,
            height: 46,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: canSend ? (pressed ? colors.ctaPressed : colors.cta) : colors.line,
            boxShadow: canSend ? shadow.glow : undefined,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          {sending ? <ActivityIndicator color={colors.white} /> : <Icon sf="paperplane.fill" md="send" size={19} color={canSend ? colors.white : colors.muted} />}
        </Pressable>
      </View>
      {remaining <= COUNT_FROM ? (
        <Text style={[text.caption, tabular, { color: remaining <= 20 ? colors.onDanger : colors.muted, textAlign: 'right' }]}>
          {`${draft.length.toLocaleString('vi-VN')}/${CHAT_MESSAGE_MAX_LENGTH.toLocaleString('vi-VN')}`}
        </Text>
      ) : null}
      {error ? (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
          <Icon sf="exclamationmark.circle.fill" md="error" size={16} color={colors.onDanger} />
          <Text style={[text.footnote, { flex: 1, color: colors.onDanger }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

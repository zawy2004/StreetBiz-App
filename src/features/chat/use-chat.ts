import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useDualMutation, useDualQuery } from '@/core/api/dual';
import { chatApi } from '@/core/api/messaging-api';
import { isLiveApi } from '@/core/config/env';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

import { sortThreads, useChat, type ChatSide } from './chat-store';

/** One row of the inbox. `key` is what the thread route takes. */
export type ThreadSummary = {
  key: string;
  storefrontId: string;
  title: string;
  preview: string;
  lastAt?: string;
  lastFromMe: boolean;
  unread: number;
};

export type ThreadMessage = { id: string; mine: boolean; text: string; at: string };

/**
 * Inbox for either side. Buyers open threads by storefront id; sellers by the
 * conversation (live) or the buyer's id (demo).
 */
export function useConversations(side: ChatSide) {
  const userId = useAuthStore((s) => s.user?.id);
  const { storefront } = useMarketplaceGate();
  const threads = useChat((s) => s.threads);
  const stores = useMockDb((s) => s.storefronts);

  const mine = side === 'CUSTOMER' ? threads.filter((t) => t.customerId === userId) : threads.filter((t) => t.storefrontId === storefront?.id);
  const mock = sortThreads(mine).map((t): ThreadSummary => {
    const last = t.messages[t.messages.length - 1];
    return {
      key: side === 'CUSTOMER' ? t.storefrontId : t.customerId,
      storefrontId: t.storefrontId,
      title: side === 'CUSTOMER' ? (stores.find((s) => s.id === t.storefrontId)?.name ?? 'Quán') : t.customerName,
      preview: last?.text ?? '',
      lastAt: last?.at,
      lastFromMe: last?.from === side,
      unread: t.unread[side],
    };
  });

  return useDualQuery({
    key: ['chat', userId, 'conversations'],
    live: async () =>
      (await chatApi.conversations()).map(
        (c): ThreadSummary => ({
          key: side === 'CUSTOMER' ? String(c.storefrontId) : String(c.conversationId),
          storefrontId: String(c.storefrontId),
          title: side === 'CUSTOMER' ? c.storefrontName : `${c.counterpartName} · ${c.storefrontName}`,
          preview: c.lastMessagePreview ?? '',
          lastAt: c.lastMessageAt ?? undefined,
          lastFromMe: c.lastMessageFromMe,
          unread: c.unreadCount,
        }),
      ),
    mock,
    enabled: Boolean(userId),
    refetchInterval: 15_000,
  });
}

/** Unread messages for the tab badge. */
export function useChatUnread(side: ChatSide): number {
  const userId = useAuthStore((s) => s.user?.id);
  const { storefront } = useMarketplaceGate();
  const mock = useChat((s) =>
    s.threads.reduce((n, t) => ((side === 'CUSTOMER' ? t.customerId === userId : t.storefrontId === storefront?.id) ? n + t.unread[side] : n), 0),
  );
  const query = useDualQuery({
    key: ['chat', userId, 'unread'],
    live: async () => (await chatApi.unreadCount()).unreadCount,
    mock,
    enabled: Boolean(userId),
    refetchInterval: 20_000,
  });
  return query.data ?? 0;
}

/**
 * A single conversation. Live it polls every few seconds (the backend also
 * pushes over SignalR, which the web client uses; polling keeps the app simple
 * and survives flaky mobile connections).
 */
export function useThread(side: ChatSide, key: string | undefined) {
  const user = useAuthStore((s) => s.user);
  const { storefront } = useMarketplaceGate();
  const chat = useChat();

  // Buyers address a shop; live, that first has to be turned into a conversation.
  const started = useQuery({
    queryKey: ['chat', user?.id, 'start', key],
    queryFn: () => chatApi.start(Number(key)),
    enabled: isLiveApi && side === 'CUSTOMER' && Boolean(key),
    staleTime: Infinity,
  });
  const conversationId = side === 'CUSTOMER' ? started.data?.conversationId : key ? Number(key) : undefined;

  // Demo thread coordinates.
  const mockStoreId = side === 'CUSTOMER' ? key : storefront?.id;
  const mockCustomerId = side === 'CUSTOMER' ? user?.id : key;
  const mockThread = chat.threads.find((t) => t.storefrontId === mockStoreId && t.customerId === mockCustomerId);
  const storeName = useMockDb((s) => s.storefronts).find((s) => s.id === mockStoreId)?.name;

  const customer = useMemo(() => (user ? { id: user.id, name: user.fullName } : null), [user]);
  const { open, markRead } = chat;
  useEffect(() => {
    if (isLiveApi || side !== 'CUSTOMER' || !mockStoreId || !customer) return;
    open(mockStoreId, customer);
  }, [side, mockStoreId, customer, open]);
  const mockCount = mockThread?.messages.length ?? 0;
  useEffect(() => {
    if (isLiveApi || !mockStoreId || !mockCustomerId) return;
    markRead(mockStoreId, mockCustomerId, side);
  }, [mockCount, mockStoreId, mockCustomerId, side, markRead]);

  const mock = {
    title: side === 'CUSTOMER' ? (storeName ?? 'Tin nhắn') : (mockThread?.customerName ?? 'Tin nhắn'),
    messages: (mockThread?.messages ?? []).map((m): ThreadMessage => ({ id: m.id, mine: m.from === side, text: m.text, at: m.at })),
  };

  const thread = useDualQuery({
    key: ['chat', user?.id, 'thread', conversationId],
    live: async () => {
      const t = await chatApi.thread(conversationId!);
      return {
        title: side === 'CUSTOMER' ? t.conversation.storefrontName : t.conversation.counterpartName,
        messages: t.messages.map((m): ThreadMessage => ({ id: String(m.messageId), mine: m.fromMe, text: m.body, at: m.sentAt })),
      };
    },
    mock,
    enabled: Boolean(key) && (!isLiveApi || conversationId !== undefined),
    refetchInterval: 4_000,
  });

  const send = useDualMutation<string, void>({
    live: async (text) => void (await chatApi.send(conversationId!, text)),
    mock: (text) => {
      if (mockStoreId && mockCustomerId) chat.send(mockStoreId, mockCustomerId, side, text);
    },
    invalidate: [['chat']],
  });

  return {
    ...thread,
    error: thread.error ?? started.error,
    isLoading: thread.isLoading || started.isLoading,
    send: (text: string) => send.mutateAsync(text),
    sending: send.isPending,
  };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { isLiveApi } from '@/core/config/env';
import { useAuthStore } from '@/store/auth-store';
import { chatApi } from '../api/chatApi';
import { useChatRealtime } from '../realtime/useChatRealtime';
import type { ChatMessage } from '../types/chat.types';

export const chatKeys = {
  conversations: ['chat', 'conversations'] as const,
  thread: (id: string | number) => ['chat', 'thread', String(id)] as const,
  unread: ['chat', 'unread'] as const,
};

/** Chat is for buyers and sellers only; nobody else has a thread to show. */
export function useCanChat(): boolean {
  const role = useAuthStore((state) => state.user?.role_code);
  return isLiveApi && (role === 'CUSTOMER' || role === 'VENDOR');
}

/** Only a buyer may open a thread (a vendor would get 403), so only a buyer gets the button. */
export function useCanStartChat(): boolean {
  const role = useAuthStore((state) => state.user?.role_code);
  return isLiveApi && role === 'CUSTOMER';
}

export function useChatConversations() {
  const enabled = useCanChat();
  return useQuery({
    queryKey: chatKeys.conversations,
    queryFn: chatApi.conversations,
    enabled,
    // The inbox socket lives in the tab layout; polling covers it while it is down.
    refetchInterval: enabled ? 20_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useChatUnreadCount() {
  const enabled = useCanChat();
  return useQuery({
    queryKey: chatKeys.unread,
    queryFn: async () => (await chatApi.unreadCount()).unreadCount,
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useChatThread(conversationId: string | number | undefined) {
  const enabled = useCanChat() && Boolean(conversationId);
  const realtimeConnected = useRef(false);
  const query = useQuery({
    queryKey: chatKeys.thread(conversationId ?? ''),
    queryFn: () => chatApi.thread(conversationId!),
    enabled,
    // Polling is the fallback for a refused or dropped socket; once the hub is up it
    // would only duplicate what the hub already pushes.
    refetchInterval: () => (realtimeConnected.current ? false : 8_000),
    refetchIntervalInBackground: false,
  });
  const connected = useChatRealtime(conversationId, enabled);
  useEffect(() => {
    realtimeConnected.current = connected;
  }, [connected]);
  return { ...query, live: connected };
}

/** Union of two pages by message id, newest data winning, oldest message first. */
function mergeById(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.messageId, message]));
  for (const message of incoming) byId.set(message.messageId, message);
  return [...byId.values()].sort((a, b) => a.messageId - b.messageId);
}

/**
 * The thread as the reader sees it. The server always answers with a window of the newest
 * messages, so the window slides forward on every send; every message seen so far is kept
 * and the fresh window merged over it (that also refreshes read receipts in place), so a
 * slide never leaves a hole mid-conversation.
 */
export function useChatMessages(conversationId: string | number | undefined) {
  const thread = useChatThread(conversationId);
  const [loaded, setLoaded] = useState<ChatMessage[]>([]);
  const [olderHasMore, setOlderHasMore] = useState<boolean | null>(null);
  const latestPage = thread.data?.messages;
  // Fold each new window into what is kept, during render (no effect round trip).
  const [foldedPage, setFoldedPage] = useState(latestPage);
  if (latestPage !== foldedPage) {
    setFoldedPage(latestPage);
    if (latestPage?.length) setLoaded((current) => mergeById(current, latestPage));
  }

  const messages = useMemo(() => mergeById(loaded, latestPage ?? []), [loaded, latestPage]);
  const oldestLoadedId = messages[0]?.messageId;

  const loadOlder = useMutation({
    mutationFn: () => chatApi.olderMessages(conversationId!, oldestLoadedId!),
    onSuccess: (page) => {
      setLoaded((current) => mergeById(current, page.messages));
      setOlderHasMore(page.hasMore);
    },
  });

  return {
    thread,
    messages,
    hasMore: (olderHasMore ?? thread.data?.hasMore ?? false) && Boolean(oldestLoadedId),
    loadOlder: () => {
      if (!loadOlder.isPending) loadOlder.mutate();
    },
    loadingOlder: loadOlder.isPending,
    olderError: loadOlder.isError ? loadOlder.error : undefined,
  };
}

export function useSendChatMessage(conversationId: string | number | undefined) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => chatApi.send(conversationId!, body),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: chatKeys.thread(conversationId ?? '') }),
        cache.invalidateQueries({ queryKey: chatKeys.conversations }),
      ]);
    },
  });
}

/** Opens the buyer's thread with a storefront; the backend reuses an existing one. */
export function useStartChat() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (storefrontId: number) => chatApi.start(storefrontId),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });
}

import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getAccessToken } from '@/core/api/token-storage';
import { env, isLiveApi } from '@/core/config/env';

/** Kept here (not imported from useChat) so the two modules do not import each other. */
const keys = {
  conversations: ['chat', 'conversations'] as const,
  thread: (id: string | number) => ['chat', 'thread', String(id)] as const,
  unread: ['chat', 'unread'] as const,
};

type ChatMessageReceived = { conversationId: number; messageId: number };
type InboxChanged = { conversationId: number };

export function getChatHubUrl(apiBaseUrl = env.apiBaseUrl): string {
  // The API address is absolute on a phone: strip a trailing /api and point at the hub.
  return `${apiBaseUrl.replace(/\/$/, '').replace(/\/api$/, '')}/hubs/chat`;
}

function buildConnection(delays: number[]): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(getChatHubUrl(), {
      accessTokenFactory: () => getAccessToken() ?? '',
      // The API sends no Access-Control-Allow-Credentials: auth is a bearer token.
      withCredentials: false,
    })
    .withAutomaticReconnect(delays)
    .configureLogging(LogLevel.Critical)
    .build();
}

/**
 * Keeps one open thread live. The hub only says "something arrived"; the thread is
 * refetched over HTTP so read receipts and ordering stay server-authoritative.
 * Returns whether the socket is up, so the caller can fall back to polling.
 */
export function useChatRealtime(conversationId: string | number | undefined, enabled: boolean): boolean {
  const cache = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Off: nothing to do. The previous run's cleanup already marked the socket down.
    if (!enabled || !conversationId || !isLiveApi || process.env.NODE_ENV === 'test') return;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const numericId = Number(conversationId);
    const onMessage = (message: ChatMessageReceived) => {
      if (message.conversationId !== numericId) return;
      void Promise.all([
        cache.invalidateQueries({ queryKey: keys.thread(numericId) }),
        cache.invalidateQueries({ queryKey: keys.conversations }),
        cache.invalidateQueries({ queryKey: keys.unread }),
      ]);
    };

    const connection = buildConnection([0, 2_000, 5_000, 10_000]);
    connection.on('ChatMessageReceived', onMessage);
    connection.onreconnecting(() => setConnected(false));
    connection.onreconnected(async () => {
      if (disposed) return;
      try {
        await connection.invoke('SubscribeConversation', numericId);
        setConnected(true);
        // Anything that arrived while the socket was down is only in the database.
        await cache.invalidateQueries({ queryKey: keys.thread(numericId) });
      } catch {
        setConnected(false);
      }
    });
    connection.onclose(() => setConnected(false));

    const start = async () => {
      try {
        await connection.start();
        if (disposed) {
          await connection.stop();
          return;
        }
        await connection.invoke('SubscribeConversation', numericId);
        setConnected(true);
      } catch {
        setConnected(false);
        if (connection.state !== HubConnectionState.Disconnected) {
          await connection.stop().catch(() => undefined);
        }
        if (!disposed) retryTimer = setTimeout(() => void start(), 10_000);
      }
    };

    void start();
    return () => {
      disposed = true;
      setConnected(false);
      if (retryTimer) clearTimeout(retryTimer);
      connection.off('ChatMessageReceived', onMessage);
      if (connection.state === HubConnectionState.Connected) {
        void connection
          .invoke('UnsubscribeConversation', numericId)
          .catch(() => undefined)
          .finally(() => connection.stop());
      } else {
        void connection.stop();
      }
    };
  }, [cache, conversationId, enabled]);

  return connected;
}

/**
 * Every thread of the signed-in account, live on any screen of the role: the server says
 * which thread changed and nothing else; the inbox, the unread badge and that thread are
 * refetched over HTTP. Polling in the queries covers any gap while the socket is down.
 */
export function useChatInboxFeed(enabled: boolean) {
  const cache = useQueryClient();

  useEffect(() => {
    if (!enabled || !isLiveApi || process.env.NODE_ENV === 'test') return;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshInbox = () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: keys.conversations }),
        cache.invalidateQueries({ queryKey: keys.unread }),
      ]);

    const connection = buildConnection([0, 2_000, 5_000, 10_000, 30_000]);
    connection.on('ChatInboxChanged', (message: InboxChanged) => {
      void refreshInbox();
      void cache.invalidateQueries({ queryKey: keys.thread(message.conversationId) });
    });
    connection.onreconnected(async () => {
      if (disposed) return;
      try {
        await connection.invoke('SubscribeInbox');
        await refreshInbox();
      } catch {
        // Polling still covers the inbox until the next reconnect.
      }
    });

    const start = async () => {
      try {
        await connection.start();
        if (disposed) {
          await connection.stop();
          return;
        }
        await connection.invoke('SubscribeInbox');
      } catch {
        if (connection.state !== HubConnectionState.Disconnected) {
          await connection.stop().catch(() => undefined);
        }
        if (!disposed) retryTimer = setTimeout(() => void start(), 15_000);
      }
    };

    void start();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (connection.state === HubConnectionState.Connected) {
        void connection
          .invoke('UnsubscribeInbox')
          .catch(() => undefined)
          .finally(() => connection.stop());
      } else {
        void connection.stop();
      }
    };
  }, [cache, enabled]);
}

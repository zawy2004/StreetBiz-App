import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, errorMessage } from '@/core/api/problem';
import { getAccessToken } from '@/core/api/token-storage';
import { env, isLiveApi } from '@/core/config/env';
import { uuid } from '@/core/utils/uuid';
import { assistantApi } from './assistant-api';
import { applyAssistantEvent, mergeMessages, optimistic } from './assistant-state';
import type {
  AssistantConversation,
  AssistantEvent,
  AssistantLocation,
  AssistantMessage,
  AssistantPageContext,
  AssistantRole,
  Capabilities,
  ResponseStyle,
  SendRequest,
} from './types';

function chatbotHubUrl(apiBaseUrl = env.apiBaseUrl): string {
  return `${apiBaseUrl.replace(/\/$/, '').replace(/\/api$/, '')}/hubs/chatbot`;
}

/**
 * The assistant conversation (the web's `useAssistant`, without voice and image upload).
 * Answers stream over the chatbot hub as deltas; a snapshot poll every 4 s restores any
 * gap while a reply is generating, so a dropped socket never leaves an answer half-written.
 * Nothing here changes business state: the assistant only reads and explains (BR-41).
 */
export function useAssistant(role: AssistantRole, accountKey: string, pageContext?: AssistantPageContext) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [status, setStatusLabel] = useState('');
  const [error, setError] = useState('');
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [capabilityError, setCapabilityError] = useState('');
  const [before, setBefore] = useState<string | null>(null);
  const [conversationBefore, setConversationBefore] = useState<string | null>(null);

  const selected = useRef<string | undefined>(undefined);
  const connection = useRef<HubConnection | undefined>(undefined);
  const abort = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);
  const activeId = useRef<string | undefined>(undefined);
  const lastRequest = useRef<SendRequest | undefined>(undefined);
  const posting = useRef(false);
  const eventSequence = useRef(new Map<string, number>());
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const isAccount = role !== 'GUEST';
  const canUseApi = isLiveApi && isAccount;

  const refresh = useCallback(
    async (id = selected.current) => {
      if (!id || !canUseApi) return;
      const result = await assistantApi.history(id);
      if (!mounted.current || id !== selected.current) return;
      setMessages((current) => mergeMessages(current, result.items));
      setBefore(result.nextCursor);
      const active = result.items.find((m) => m.status === 'GENERATING');
      activeId.current = active?.id;
      setBusy(Boolean(active) || posting.current);
    },
    [canUseApi],
  );

  const loadConversations = useCallback(
    async (more = false) => {
      if (!canUseApi) return;
      const page = await assistantApi.conversations(more ? (conversationBefore ?? undefined) : undefined);
      if (mounted.current) {
        setConversations((current) => (more ? [...current, ...page.items] : page.items));
        setConversationBefore(page.nextCursor);
      }
    },
    [canUseApi, conversationBefore],
  );

  useEffect(() => {
    mounted.current = true;
    if (isLiveApi)
      void assistantApi
        .capabilities()
        .then((c) => {
          if (mounted.current) setCapabilities(c);
        })
        .catch((e) => {
          if (mounted.current) setCapabilityError(errorMessage(e));
        });
    if (canUseApi)
      void assistantApi
        .conversations()
        .then((p) => {
          if (mounted.current) {
            setConversations(p.items);
            setConversationBefore(p.nextCursor);
          }
        })
        .catch(() => undefined);
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, [accountKey, canUseApi]);

  useEffect(() => {
    if (!canUseApi || process.env.NODE_ENV === 'test') return;
    const hub = new HubConnectionBuilder()
      .withUrl(chatbotHubUrl(), { accessTokenFactory: () => getAccessToken() ?? '', withCredentials: false })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(LogLevel.Critical)
      .build();
    connection.current = hub;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const onEvent = (event: AssistantEvent) => {
      if (disposed || event.conversationId !== selected.current) return;
      const previous = eventSequence.current.get(event.messageId) ?? 0;
      if (event.sequence <= previous) return;
      eventSequence.current.set(event.messageId, event.sequence);
      // A gap in the sequence means a delta was missed: take the server's snapshot.
      if (previous && event.sequence > previous + 1) void refresh().catch(() => undefined);
      setMessages((current) => applyAssistantEvent(current, event));
      if (event.type === 'started') {
        activeId.current = event.messageId;
        setBusy(true);
      }
      if (event.type === 'status') setStatusLabel(event.payload.label);
      if (event.type === 'completed' || event.type === 'failed' || event.type === 'cancelled') {
        activeId.current = undefined;
        setBusy(false);
        setStatusLabel('');
      }
    };
    hub.on('ChatbotEvent', onEvent);

    const subscribed = async () => {
      if (disposed) return;
      if (selected.current) await hub.invoke('SubscribeConversation', selected.current);
      await refresh();
    };
    hub.onreconnected(() => void subscribed().catch(() => undefined));
    const start = async () => {
      if (disposed) return;
      try {
        await hub.start();
        if (disposed) {
          await hub.stop();
          return;
        }
        await subscribed();
      } catch {
        await hub.stop().catch(() => undefined);
        if (!disposed) {
          clearTimeout(retry);
          retry = setTimeout(() => void start(), 10000);
        }
      }
    };
    hub.onclose(() => {
      if (!disposed) {
        clearTimeout(retry);
        retry = setTimeout(() => void start(), 10000);
      }
    });
    void start();
    return () => {
      disposed = true;
      clearTimeout(retry);
      hub.off('ChatbotEvent', onEvent);
      connection.current = undefined;
      void hub.stop();
    };
  }, [canUseApi, accountKey, refresh]);

  useEffect(() => {
    if (!busy || !canUseApi) return;
    // Snapshots restore missed deltas and the terminal state even without a socket.
    const timer = setInterval(() => void refresh().catch(() => undefined), 4000);
    return () => clearInterval(timer);
  }, [busy, canUseApi, refresh]);

  const select = async (id?: string) => {
    if (busy || posting.current) return;
    selected.current = id;
    setConversationId(id);
    setMessages([]);
    setBefore(null);
    setError('');
    eventSequence.current.clear();
    lastRequest.current = undefined;
    if (id && connection.current?.state === HubConnectionState.Connected)
      await connection.current.invoke('SubscribeConversation', id).catch(() => undefined);
    if (id) await refresh(id).catch((e) => setError(errorMessage(e)));
  };

  /**
   * `retryOf` asks the server for a fresh answer to an earlier question (a new request id);
   * `replay` re-sends the very last request with its own id, for a response lost in transit
   * (the server then returns what it already stored instead of answering twice).
   */
  const send = async (
    content: string,
    options: { responseStyle?: ResponseStyle; location?: AssistantLocation; retryOf?: string; replay?: boolean } = {},
  ) => {
    if (busy || posting.current || !content.trim()) return;
    posting.current = true;
    setError('');
    setBusy(true);
    setStatusLabel('Đang tiếp nhận câu hỏi…');
    const request: SendRequest =
      options.replay && lastRequest.current
        ? lastRequest.current
        : {
            clientRequestId: uuid(),
            content: content.trim(),
            pageContext,
            retryOfMessageId: options.retryOf,
            responseStyle: options.responseStyle,
            ...(options.location ? { location: options.location } : {}),
          };
    lastRequest.current = request;
    const controller = new AbortController();
    abort.current = controller;
    const ordinal = (messagesRef.current.at(-1)?.ordinal ?? 0) + 1;
    const localUser = { ...optimistic(request.content, request.clientRequestId, ordinal), responseStyle: request.responseStyle };
    setMessages((current) => mergeMessages(current, [localUser]));
    try {
      if (!isLiveApi) {
        setError('Trợ lý chỉ chạy khi ứng dụng nối với máy chủ StreetBiz.');
        return;
      }
      if (!isAccount) {
        const answer = await assistantApi.guest(request.content, controller.signal, request.responseStyle);
        if (mounted.current)
          setMessages((current) => mergeMessages(current, [{ ...answer, clientRequestId: request.clientRequestId, ordinal: ordinal + 1 }]));
        return;
      }
      let id = selected.current;
      if (!id) {
        const created = await assistantApi.create(request.clientRequestId);
        if (!mounted.current) return;
        id = created.id;
        selected.current = id;
        setConversationId(id);
      }
      if (connection.current?.state === HubConnectionState.Connected)
        await connection.current.invoke('SubscribeConversation', id).catch(() => undefined);
      const result = await assistantApi.send(id, request, controller.signal);
      if (!mounted.current || id !== selected.current) return;
      setMessages((current) => mergeMessages(current, [result.userMessage, result.assistantMessage]));
      activeId.current = result.assistantMessage.status === 'GENERATING' ? result.assistantMessage.id : undefined;
      await loadConversations().catch(() => undefined);
    } catch (e) {
      if (!mounted.current) return;
      setError(errorMessage(e));
      if (e instanceof ApiError && e.activeMessageId && selected.current) {
        activeId.current = e.activeMessageId;
        await refresh().catch(() => undefined);
      } else if (selected.current) await refresh().catch(() => undefined);
    } finally {
      posting.current = false;
      if (mounted.current) {
        setBusy(Boolean(activeId.current));
        setStatusLabel('');
      }
    }
  };

  const stop = async () => {
    if (selected.current && activeId.current) {
      try {
        const snapshot = await assistantApi.cancel(selected.current, activeId.current);
        if (mounted.current) setMessages((current) => mergeMessages(current, [snapshot]));
      } catch (e) {
        if (mounted.current) setError(errorMessage(e));
        return;
      }
    }
    abort.current?.abort();
    activeId.current = undefined;
    setBusy(false);
    setStatusLabel('');
  };

  const remove = async () => {
    if (!conversationId || busy) return;
    try {
      await assistantApi.delete(conversationId);
      await select();
      await loadConversations();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const loadOlder = async () => {
    if (!conversationId || !before) return;
    try {
      const page = await assistantApi.history(conversationId, before);
      if (mounted.current && conversationId === selected.current) {
        setMessages((current) => mergeMessages(current, page.items));
        setBefore(page.nextCursor);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  /** Logs whether an answer helped; it changes nothing else (BR-41). */
  const feedback = async (message: AssistantMessage, helpful: boolean) => {
    if (!canUseApi || !selected.current) return false;
    try {
      await assistantApi.feedback(selected.current, message.id, helpful);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  };

  return {
    messages,
    conversations,
    conversationId,
    busy,
    status,
    error,
    capabilities,
    capabilityError,
    hasOlder: Boolean(before),
    hasMoreConversations: Boolean(conversationBefore),
    select,
    send,
    stop,
    remove,
    loadOlder,
    loadConversations,
    feedback,
    /** The error banner's "Thử lại yêu cầu": the same request again (see `send`). */
    retryRequest: () => {
      const last = lastRequest.current;
      if (last) void send(last.content, { replay: true });
    },
    /** "Hỏi lại" / "Tạo lại câu trả lời": a new answer to the question before `answer`. */
    regenerate: (answer: AssistantMessage, responseStyle?: ResponseStyle) => {
      const index = messagesRef.current.findIndex((m) => m.id === answer.id);
      const question = messagesRef.current
        .slice(0, index < 0 ? undefined : index)
        .reverse()
        .find((m) => m.sender === 'USER');
      if (question) void send(question.content, { retryOf: answer.id, responseStyle: answer.responseStyle ?? responseStyle });
    },
  };
}

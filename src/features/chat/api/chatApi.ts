import { apiGet, apiPost } from '@/core/api/client';
import type {
  ChatConversation,
  ChatMessage,
  ChatMessagePage,
  ChatThread,
} from '../types/chat.types';

export const chatApi = {
  conversations: () => apiGet<ChatConversation[]>('/chat/conversations'),

  /** Opens the customer's thread with a storefront, or returns the existing one. */
  start: (storefrontId: number) =>
    apiPost<ChatConversation>('/chat/conversations', { storefrontId }),

  thread: (conversationId: string | number, take = 50) =>
    apiGet<ChatThread>(`/chat/conversations/${conversationId}?take=${take}`),

  olderMessages: (conversationId: string | number, beforeMessageId: number, take = 50) =>
    apiGet<ChatMessagePage>(
      `/chat/conversations/${conversationId}/messages?before=${beforeMessageId}&take=${take}`,
    ),

  send: (conversationId: string | number, body: string) =>
    apiPost<ChatMessage>(`/chat/conversations/${conversationId}/messages`, { body }),

  unreadCount: () => apiGet<{ unreadCount: number }>('/chat/unread-count'),
};

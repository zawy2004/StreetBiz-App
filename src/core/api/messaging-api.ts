import { apiGet, apiPost } from './client';

/** Buyer ↔ storefront chat (`ChatController`) and in-app notifications (`NotificationsController`). */

export type ChatConversation = {
  conversationId: number;
  storefrontId: number;
  storefrontName: string;
  storefrontImageUrl: string | null;
  customerUserId: number;
  customerName: string;
  /** Who the signed-in account is talking to: the shop, or the buyer. */
  counterpartName: string;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean;
  unreadCount: number;
};

export type ChatMessageDto = {
  messageId: number;
  conversationId: number;
  senderUserId: number;
  senderName: string;
  fromMe: boolean;
  body: string;
  sentAt: string;
  readAt: string | null;
};

export type ChatThreadDto = { conversation: ChatConversation; messages: ChatMessageDto[]; hasMore: boolean };

export const chatApi = {
  conversations: () => apiGet<ChatConversation[]>('/chat/conversations'),
  /** Opens the buyer's thread with a storefront, or returns the existing one. */
  start: (storefrontId: number) => apiPost<ChatConversation>('/chat/conversations', { storefrontId }),
  /** Reading a thread marks it read for the caller. */
  thread: (conversationId: string | number, take = 50) => apiGet<ChatThreadDto>(`/chat/conversations/${conversationId}?take=${take}`),
  send: (conversationId: string | number, body: string) => apiPost<ChatMessageDto>(`/chat/conversations/${conversationId}/messages`, { body }),
  unreadCount: () => apiGet<{ unreadCount: number }>('/chat/unread-count'),
};

export type NotificationDto = {
  notificationId: number;
  type: string;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  isRead: boolean;
  sentAt: string;
};

export const notificationsApi = {
  list: (take = 50) => apiGet<{ items: NotificationDto[]; hasMore: boolean }>(`/notifications?take=${take}`),
  unreadCount: () => apiGet<{ unreadCount: number }>('/notifications/unread-count'),
  markRead: (notificationId: number) => apiPost<void>(`/notifications/${notificationId}/read`),
  markAllRead: () => apiPost<void>('/notifications/read-all'),
};

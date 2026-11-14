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

export type ChatMessage = {
  messageId: number;
  conversationId: number;
  senderUserId: number;
  senderName: string;
  fromMe: boolean;
  body: string;
  sentAt: string;
  readAt: string | null;
};

export type ChatThread = {
  conversation: ChatConversation;
  messages: ChatMessage[];
  /** Older messages exist before `messages[0]`. */
  hasMore: boolean;
};

export type ChatMessagePage = {
  messages: ChatMessage[];
  hasMore: boolean;
};

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

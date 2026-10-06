import dayjs from 'dayjs';
import { create } from 'zustand';

export type ChatMessage = { id: string; from: 'me' | 'them'; text: string; at: string };
export type Conversation = { storefrontId: string; unread: number; messages: ChatMessage[] };

type ChatState = {
  conversations: Conversation[];
  open: (storefrontId: string) => void;
  markRead: (storefrontId: string) => void;
  send: (storefrontId: string, text: string) => void;
};

const mid = () => `MSG-${Math.random().toString(36).slice(2, 9)}`;

const seed: Conversation[] = [
  {
    storefrontId: 'STORE-002',
    unread: 1,
    messages: [
      { id: 'MSG-1', from: 'me', text: 'Cho mình 2 bánh mì thịt nướng nhé', at: dayjs().subtract(25, 'minute').toISOString() },
      { id: 'MSG-2', from: 'them', text: 'Đơn của bạn sẵn rồi ạ', at: dayjs().subtract(5, 'minute').toISOString() },
    ],
  },
];

/** Mock chat: the shop answers every message with a canned reply after a moment. */
export const useChat = create<ChatState>((set, get) => ({
  conversations: seed,

  open: (storefrontId) => {
    if (get().conversations.some((c) => c.storefrontId === storefrontId)) return;
    set((s) => ({ conversations: [...s.conversations, { storefrontId, unread: 0, messages: [] }] }));
  },

  markRead: (storefrontId) =>
    set((s) => ({ conversations: s.conversations.map((c) => (c.storefrontId === storefrontId ? { ...c, unread: 0 } : c)) })),

  send: (storefrontId, text) => {
    const push = (from: 'me' | 'them', body: string) =>
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.storefrontId === storefrontId
            ? { ...c, messages: [...c.messages, { id: mid(), from, text: body, at: new Date().toISOString() }] }
            : c,
        ),
      }));
    push('me', text);
    setTimeout(() => push('them', 'Dạ em nhận được rồi ạ, bạn chờ chút nhé.'), 1500);
  },
}));

import dayjs from 'dayjs';
import { create } from 'zustand';

export type ChatSide = 'CUSTOMER' | 'VENDOR';
export type ChatMessage = { id: string; from: ChatSide; text: string; at: string };

/** One buyer ↔ storefront conversation, seen from both sides (FE: features/chat). */
export type ChatThread = {
  storefrontId: string;
  customerId: string;
  customerName: string;
  /** Unread counts per side: what the buyer has not seen, and what the shop has not seen. */
  unread: Record<ChatSide, number>;
  messages: ChatMessage[];
};

type ChatState = {
  threads: ChatThread[];
  open: (storefrontId: string, customer: { id: string; name: string }) => void;
  markRead: (storefrontId: string, customerId: string, side: ChatSide) => void;
  send: (storefrontId: string, customerId: string, from: ChatSide, text: string) => void;
};

const mid = () => `MSG-${Math.random().toString(36).slice(2, 9)}`;
const ago = (minutes: number) => dayjs().subtract(minutes, 'minute').toISOString();
const other = (side: ChatSide): ChatSide => (side === 'CUSTOMER' ? 'VENDOR' : 'CUSTOMER');

const AUTO_REPLY: Record<ChatSide, string> = {
  VENDOR: 'Dạ quán nhận được rồi ạ, bạn chờ chút nhé.',
  CUSTOMER: 'Dạ em cảm ơn ạ!',
};

const seed: ChatThread[] = [
  {
    storefrontId: 'STORE-002',
    customerId: 'USR-CUS',
    customerName: 'Trần Hồng Anh',
    unread: { CUSTOMER: 1, VENDOR: 0 },
    messages: [
      { id: 'MSG-1', from: 'CUSTOMER', text: 'Cho mình 2 bánh mì thịt nướng nhé', at: ago(25) },
      { id: 'MSG-2', from: 'VENDOR', text: 'Đơn của bạn sẵn rồi ạ', at: ago(5) },
    ],
  },
  {
    storefrontId: 'STORE-001',
    customerId: 'USR-CUS',
    customerName: 'Trần Hồng Anh',
    unread: { CUSTOMER: 0, VENDOR: 1 },
    messages: [
      { id: 'MSG-3', from: 'CUSTOMER', text: 'Chị ơi mai 6h sáng có xôi gà chưa ạ?', at: ago(95) },
      { id: 'MSG-4', from: 'VENDOR', text: 'Có rồi em, 5h30 là có nha.', at: ago(80) },
      { id: 'MSG-5', from: 'CUSTOMER', text: 'Dạ em đặt 2 phần, lấy lúc 6h15 nha chị', at: ago(12) },
    ],
  },
  {
    storefrontId: 'STORE-001',
    customerId: 'GUEST-BINH',
    customerName: 'Nguyễn Văn Bình',
    unread: { CUSTOMER: 0, VENDOR: 1 },
    messages: [{ id: 'MSG-6', from: 'CUSTOMER', text: 'Quán còn xôi mặn thập cẩm không chị?', at: ago(40) }],
  },
];

const matches = (t: ChatThread, storefrontId: string, customerId: string) =>
  t.storefrontId === storefrontId && t.customerId === customerId;

/** Mock chat: the other side answers every message with a canned reply after a moment. */
export const useChat = create<ChatState>((set, get) => ({
  threads: seed,

  open: (storefrontId, customer) => {
    if (get().threads.some((t) => matches(t, storefrontId, customer.id))) return;
    set((s) => ({
      threads: [
        ...s.threads,
        { storefrontId, customerId: customer.id, customerName: customer.name, unread: { CUSTOMER: 0, VENDOR: 0 }, messages: [] },
      ],
    }));
  },

  markRead: (storefrontId, customerId, side) =>
    set((s) => ({
      threads: s.threads.map((t) => (matches(t, storefrontId, customerId) && t.unread[side] ? { ...t, unread: { ...t.unread, [side]: 0 } } : t)),
    })),

  send: (storefrontId, customerId, from, text) => {
    const push = (sender: ChatSide, body: string) =>
      set((s) => ({
        threads: s.threads.map((t) =>
          matches(t, storefrontId, customerId)
            ? {
                ...t,
                messages: [...t.messages, { id: mid(), from: sender, text: body, at: new Date().toISOString() }],
                unread: { ...t.unread, [other(sender)]: t.unread[other(sender)] + 1 },
              }
            : t,
        ),
      }));
    push(from, text);
    setTimeout(() => push(other(from), AUTO_REPLY[other(from)]), 1500);
  },
}));

/** Newest activity first; empty drafts (opened but never written to) are hidden. */
export function sortThreads(threads: ChatThread[]) {
  return threads
    .filter((t) => t.messages.length)
    .sort((a, b) => (b.messages[b.messages.length - 1]?.at ?? '').localeCompare(a.messages[a.messages.length - 1]?.at ?? ''));
}

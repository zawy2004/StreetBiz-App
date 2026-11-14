import type { ChatMessage } from './types/chat.types';

/**
 * Display-only layout of a thread, all in Asia/Ho_Chi_Minh (the web's `thread-format.ts`
 * and `chat-format.ts`): day dividers, which messages sit together, inbox timestamps.
 * The order is never touched; it stays by messageId.
 */
const VN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const VN_WEEKDAY = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long' });
// en-GB gives "06/10" everywhere; some ICU builds print vi-VN day-month as "06-10".
const VN_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' });
const VN_TIME = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });

const GROUP_GAP_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 3600 * 1000;

function valid(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

function dayKey(value: string): string {
  const at = valid(value);
  return at ? VN_DAY.format(at) : '';
}

/** "14:05". */
export function messageTime(value: string): string {
  const at = valid(value);
  return at ? VN_TIME.format(at) : '';
}

/** "Hôm nay", "Hôm qua", or "Thứ Hai, 06/10". */
export function dayLabel(value: string, now: number): string {
  const at = valid(value);
  if (!at) return '';
  const key = VN_DAY.format(at);
  if (key === VN_DAY.format(new Date(now))) return 'Hôm nay';
  if (key === VN_DAY.format(new Date(now - DAY_MS))) return 'Hôm qua';
  const weekday = VN_WEEKDAY.format(at);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${VN_DATE.format(at)}`;
}

/** "14:05" for today, "Hôm qua", otherwise "27/09": enough to place a thread without noise. */
export function conversationTimestamp(value: string | null, now: number): string {
  const at = valid(value);
  if (!at) return '';
  const key = VN_DAY.format(at);
  if (key === VN_DAY.format(new Date(now))) return VN_TIME.format(at);
  if (key === VN_DAY.format(new Date(now - DAY_MS))) return 'Hôm qua';
  return VN_DATE.format(at);
}

export type ThreadItem = {
  message: ChatMessage;
  /** A day divider goes before this message. */
  dayBreak?: string;
  /** Same sender within five minutes as the message before / after it. */
  joinsPrevious: boolean;
  joinsNext: boolean;
};

export function layoutThread(messages: ChatMessage[], now: number): ThreadItem[] {
  const close = (a: ChatMessage | undefined, b: ChatMessage | undefined) =>
    Boolean(
      a &&
        b &&
        a.fromMe === b.fromMe &&
        a.senderUserId === b.senderUserId &&
        dayKey(a.sentAt) === dayKey(b.sentAt) &&
        Math.abs(new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()) <= GROUP_GAP_MS,
    );
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const newDay = !previous || dayKey(previous.sentAt) !== dayKey(message.sentAt);
    return {
      message,
      dayBreak: newDay ? dayLabel(message.sentAt, now) || undefined : undefined,
      joinsPrevious: !newDay && close(previous, message),
      joinsNext: close(message, next),
    };
  });
}

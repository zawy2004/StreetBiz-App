const vietnamDateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
});

export const formatOrderDate = (value: string) => vietnamDateTime.format(new Date(value));

const vietnamTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
});

/** "18:48": the clock time a seller reads off a ticket. */
export const formatOrderTime = (value: string) => vietnamTime.format(new Date(value));

/** Whole minutes since `value`, never negative (a phone clock can run behind). */
export function minutesSince(value: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000));
}

/** "vừa xong", "12 phút", "2 giờ 5 phút", "3 ngày": how long an order has waited. */
export function formatWait(minutes: number): string {
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút`;
  // Past a day the minutes are noise; the seller only needs to see it is stale.
  if (minutes >= 24 * 60) return `${Math.floor(minutes / (24 * 60))} ngày`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

/**
 * How urgent a new order is. A street stall serves in minutes, so a paid order
 * nobody has accepted in 5 minutes needs a look and in 10 needs it now.
 */
export function waitTone(minutes: number): 'calm' | 'warn' | 'late' {
  if (minutes >= 10) return 'late';
  if (minutes >= 5) return 'warn';
  return 'calm';
}

/** Items shown before the rest fold into "+N món nữa". */
export const TICKET_ITEM_LIMIT = 4;

/** Folding a single item saves no room and costs the cook a tap: show it. */
export function ticketItemsShown(count: number): number {
  return count <= TICKET_ITEM_LIMIT + 1 ? count : TICKET_ITEM_LIMIT;
}

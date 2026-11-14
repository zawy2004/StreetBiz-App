import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

import { TERMINAL_ORDER_STATUSES, type Order, type OrderStatus } from '../types/order.types';

/**
 * Display helpers shared by the cart, checkout, order and pickup screens: gateway names,
 * Asia/Ho_Chi_Minh day and clock formats, and the small derivations the screens print.
 * Nothing here fetches or stores. (The web's CSS paper-edge masks live in the components.)
 */

/** The phone's own idea of being online; true where it cannot tell. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)),
    [],
  );
  return online;
}

const providerNames: Record<string, string> = { MOMO: 'MoMo', ZALOPAY: 'ZaloPay' };

/** "MoMo" / "ZaloPay" for the gateway codes the backend sends; anything else as sent. */
export function providerName(code: string | null | undefined): string | null {
  if (!code) return null;
  return providerNames[code] ?? code;
}

const vietnamDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const vietnamDate = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const vietnamClock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** "2026-10-10": the calendar day in Asia/Ho_Chi_Minh, for grouping. */
export const vietnamDayKey = (value: string | number | Date) => vietnamDay.format(new Date(value));

/** "Hôm nay" / "Hôm qua" / "08/10/2026", read in Asia/Ho_Chi_Minh. */
export function dayHeading(dayKey: string, now: number = Date.now()): string {
  if (dayKey === vietnamDayKey(now)) return 'Hôm nay';
  if (dayKey === vietnamDayKey(now - 24 * 60 * 60 * 1000)) return 'Hôm qua';
  return vietnamDate.format(new Date(`${dayKey}T12:00:00+07:00`));
}

/** "07:42:10" in Asia/Ho_Chi_Minh. */
export const formatClock = (value: number | Date) => vietnamClock.format(new Date(value));

/** "2× Bánh mì · 1× Trà đá": the dishes of an order on one line. */
export const orderItemsSummary = (order: Order) =>
  order.items.map((item) => `${item.quantity}× ${item.itemName}`).join(' · ');

/** A short line for the two states where the buyer has something to do. */
export function orderStatusHint(order: Order): string | null {
  if (order.orderStatus === 'PENDING_PAYMENT') return 'Chưa thanh toán · giỏ đang khoá';
  if (order.orderStatus === 'READY_FOR_PICKUP') return 'Mang mã đến quầy';
  return null;
}

/** The buyer's four stages between paying and collecting (C12, C13). */
export const BUYER_STAGES: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'];

/** The normal path of a paid order, from the stall's inbox to the buyer's hands. */
const ORDER_FLOW: OrderStatus[] = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
];

/** Stages still ahead of `status` on the normal path; none once the order has ended. */
export function upcomingStages(status: OrderStatus): OrderStatus[] {
  if (status === 'PENDING_PAYMENT') return ORDER_FLOW;
  if (TERMINAL_ORDER_STATUSES.has(status)) return [];
  const index = ORDER_FLOW.indexOf(status);
  return index < 0 ? [] : ORDER_FLOW.slice(index + 1);
}

export function refundPresentation(status: string) {
  if (status === 'SUCCESS') {
    return {
      label: 'Đã hoàn tiền',
      tone: 'ok' as const,
      message: 'Hệ thống đã ghi nhận hoàn tiền thành công.',
    };
  }
  if (status === 'FAILED') {
    return {
      label: 'Hoàn tiền thất bại',
      tone: 'danger' as const,
      message: 'Hoàn tiền chưa thành công. Vui lòng liên hệ hỗ trợ.',
    };
  }
  return {
    label: 'Đang hoàn tiền',
    tone: 'pending' as const,
    message: 'Yêu cầu hoàn tiền đang chờ cổng thanh toán xử lý.',
  };
}

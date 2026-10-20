import { formatVnd } from '@/utils/format';
import type { Order } from '../types/order.types';

/**
 * Decides whether a refreshed "newest new order" is news. The first look only
 * sets the baseline - opening the app must not ring for orders already waiting
 * - and after that an order counts once, however many refreshes see it, and
 * whether the refresh came from the socket or from polling.
 */
export function detectNewOrder(
  seenUpTo: number | null,
  newest: Order | undefined,
): { seenUpTo: number; arrived: Order | null } {
  const newestId = newest?.orderId ?? 0;
  if (seenUpTo === null) return { seenUpTo: newestId, arrived: null };
  if (newest && newestId > seenUpTo) return { seenUpTo: newestId, arrived: newest };
  return { seenUpTo, arrived: null };
}

/** "3× Bánh mì thịt nướng, 1× Xôi gà xé và 2 món khác": what to make, at a glance. */
export function summariseItems(order: Order, shown = 2): string {
  const lines = order.items.slice(0, shown).map((item) => `${item.quantity}× ${item.itemName}`);
  const rest = order.items.length - shown;
  return rest > 0 ? `${lines.join(', ')} và ${rest} món khác` : lines.join(', ');
}

/** The words of a new-order alert, shared by the toast and the system notification. */
export function newOrderMessage(order: Order): { title: string; body: string } {
  return {
    title: `Đơn mới từ ${order.customerName || 'khách hàng'} · ${formatVnd(order.totalAmount)}`,
    body: summariseItems(order) || 'Mở trang Đơn hàng để xem chi tiết.',
  };
}

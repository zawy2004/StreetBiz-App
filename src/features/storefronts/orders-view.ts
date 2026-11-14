import { minutesSince, waitTone } from '@/features/orders/components/order-format';
import type { Order } from '@/features/orders/types/order.types';

/** When the order entered the stage it is in now; placed time if history is silent. */
export function enteredStageAt(order: Order): string {
  const entry = [...order.statusHistory]
    .reverse()
    .find((history) => history.toStatus === order.orderStatus);
  return entry?.changedAt ?? order.placedAt ?? order.createdAt;
}

/** "5× Bánh mì thịt nướng": how much of each dish the shown tickets ask for, most first. */
export function tallyItems(orders: Order[]): { itemName: string; quantity: number }[] {
  const totals = new Map<string, number>();
  for (const order of orders)
    for (const item of order.items)
      totals.set(item.itemName, (totals.get(item.itemName) ?? 0) + item.quantity);
  return [...totals.entries()]
    .map(([itemName, quantity]) => ({ itemName, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.itemName.localeCompare(b.itemName, 'vi'));
}

/** New orders on the page that nobody has accepted for 10 minutes or more. */
export function lateCount(orders: Order[], now: number): number {
  return orders.filter(
    (order) =>
      order.orderStatus === 'PLACED' &&
      waitTone(minutesSince(enteredStageAt(order), now)) === 'late',
  ).length;
}

const PROVIDERS: Record<string, string> = { MOMO: 'MoMo', ZALOPAY: 'ZaloPay' };

/** "MoMo", "ZaloPay": the wallet as people write it; unknown codes as sent. */
export function providerLabel(code: string): string {
  return PROVIDERS[code.toUpperCase()] ?? code;
}

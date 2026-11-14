import type { OrderStatus } from '../types/order.types';

export type VendorOrderAction = 'accept' | 'reject' | 'preparing' | 'ready' | 'handover';

export function vendorActionsFor(status: OrderStatus): VendorOrderAction[] {
  if (status === 'PLACED') return ['accept', 'reject'];
  if (status === 'ACCEPTED') return ['preparing'];
  if (status === 'PREPARING') return ['ready'];
  if (status === 'READY_FOR_PICKUP') return ['handover'];
  return [];
}

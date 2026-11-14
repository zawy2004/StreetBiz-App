import type { SellerMenuItem } from '@/core/api/seller-store-api';

export type BuyerVisibility = {
  /** Dishes a buyer can see: not hidden by an admin and not waiting on ATTP. */
  visible: number;
  total: number;
  soldOut: number;
  needsAttp: number;
  pending: number;
  hidden: number;
  storePaused: boolean;
};

/**
 * How much of the menu reaches buyers. MISSING and PENDING dishes are not shown
 * to buyers (see `DishFoodSafetyStatus`), nor are dishes an admin hid; a paused
 * stall shows none.
 */
export function buyerVisibility(
  items: Pick<SellerMenuItem, 'availabilityStatus' | 'foodSafetyStatus'>[],
  storeStatus: string | undefined,
): BuyerVisibility {
  let visible = 0;
  let soldOut = 0;
  let needsAttp = 0;
  let pending = 0;
  let hidden = 0;
  for (const item of items) {
    const isHidden = item.availabilityStatus === 'HIDDEN';
    if (isHidden) hidden += 1;
    if (item.foodSafetyStatus === 'MISSING') needsAttp += 1;
    if (item.foodSafetyStatus === 'PENDING') pending += 1;
    if (item.availabilityStatus === 'SOLD_OUT') soldOut += 1;
    if (!isHidden && item.foodSafetyStatus !== 'MISSING' && item.foodSafetyStatus !== 'PENDING')
      visible += 1;
  }
  return {
    visible,
    total: items.length,
    soldOut,
    needsAttp,
    pending,
    hidden,
    storePaused: storeStatus === 'PAUSED',
  };
}

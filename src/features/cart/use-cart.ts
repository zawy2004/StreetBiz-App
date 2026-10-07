import { cartApi, type CommerceCart } from '@/core/api/commerce-api';
import { useDualMutation, useDualQuery } from '@/core/api/dual';
import { apiAssetUrl } from '@/core/api/client';
import { requireAuth } from '@/core/auth/require-auth';
import { isLiveApi } from '@/core/config/env';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

import { useCart } from './cart-store';

export type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
  soldOut: boolean;
  imageUrl?: string;
  subtotal: number;
};

export type CartView = {
  cartId?: string;
  storefrontId?: string;
  storefrontName?: string;
  lines: CartLine[];
  count: number;
  total: number;
  /** Live: an order from this cart is waiting for payment, so the cart is locked. */
  pendingOrderId?: string;
};

const EMPTY: CartView = { lines: [], count: 0, total: 0 };

function fromApi(cart: CommerceCart | null): CartView {
  if (!cart) return EMPTY;
  const lines = cart.items.map(
    (i): CartLine => ({
      menuItemId: String(i.menuItemId),
      name: i.itemName,
      price: i.unitPrice,
      quantity: i.quantity,
      note: i.note ?? undefined,
      soldOut: i.availabilityStatus !== 'AVAILABLE',
      imageUrl: apiAssetUrl(i.imageUrl),
      subtotal: i.unitPrice * i.quantity,
    }),
  );
  return {
    cartId: String(cart.cartId),
    storefrontId: String(cart.storefrontId),
    storefrontName: cart.storefrontName,
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    total: cart.subtotal,
    pendingOrderId: cart.pendingOrderId ? String(cart.pendingOrderId) : undefined,
  };
}

/**
 * The buyer's cart. Demo mode keeps it on the device (guests can fill it);
 * live it is the server cart (CART-01), which needs an account.
 */
export function useCartView() {
  const userId = useAuthStore((s) => s.user?.id);
  const items = useCart((s) => s.items);
  const menu = useMockDb((s) => s.menuItems);
  const stores = useMockDb((s) => s.storefronts);

  const lines = items.flatMap((i): CartLine[] => {
    const item = menu.find((m) => m.id === i.menuItemId);
    return item
      ? [{ menuItemId: i.menuItemId, name: item.name, price: item.price, quantity: i.quantity, note: i.note, soldOut: item.availability_status === 'SOLD_OUT', subtotal: item.price * i.quantity }]
      : [];
  });
  const storefrontId = items[0]?.storefrontId;
  const mock: CartView = {
    storefrontId,
    storefrontName: stores.find((s) => s.id === storefrontId)?.name,
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    total: lines.reduce((n, l) => n + l.subtotal, 0),
  };

  const query = useDualQuery({
    key: ['cart', userId],
    live: async () => fromApi(await cartApi.get()),
    mock,
    enabled: !isLiveApi || Boolean(userId),
  });
  // Live guests have no server cart.
  return isLiveApi && !userId ? { ...query, data: EMPTY } : query;
}

/**
 * Live, the cart is server-side and needs an account: sends a guest to sign in
 * (coming back to `next`) and returns false. Demo guests may fill a local cart.
 */
export function canUseCart(next: string): boolean {
  return !isLiveApi || requireAuth(next);
}

export function useAddToCart() {
  return useDualMutation<{ item: { id: string; storefrontId: string; name: string; price: number }; quantity: number; note?: string }, void>({
    live: async ({ item, quantity, note }) => void (await cartApi.add(Number(item.id), quantity, note)),
    mock: ({ item, quantity, note }) =>
      useCart.getState().add(
        { id: item.id, storefrontId: item.storefrontId, name: item.name, price: item.price, description: '', categoryId: '', availability_status: 'AVAILABLE' },
        quantity,
        note,
      ),
    invalidate: [['cart']],
  });
}

/** Quantity 0 removes the line. */
export function useSetCartQuantity() {
  return useDualMutation<{ menuItemId: string; quantity: number; note?: string }, void>({
    live: async ({ menuItemId, quantity, note }) =>
      void (quantity <= 0 ? await cartApi.remove(Number(menuItemId)) : await cartApi.update(Number(menuItemId), quantity, note)),
    mock: ({ menuItemId, quantity }) => useCart.getState().setQuantity(menuItemId, quantity),
    invalidate: [['cart']],
  });
}

export function useClearCart() {
  return useDualMutation<void, void>({
    live: () => cartApi.clear(),
    mock: () => useCart.getState().clear(),
    invalidate: [['cart']],
  });
}

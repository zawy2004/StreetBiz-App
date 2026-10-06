import { useMockDb } from '@/mocks/db';

import { useCart } from './cart-store';

/** Cart lines joined with their menu item, plus totals. */
export function useCartSummary() {
  const items = useCart((s) => s.items);
  const menu = useMockDb((s) => s.menuItems);
  const lines = items.flatMap((i) => {
    const item = menu.find((m) => m.id === i.menuItemId);
    return item ? [{ ...i, item, subtotal: item.price * i.quantity }] : [];
  });
  return {
    lines,
    storefrontId: lines[0]?.storefrontId,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    total: lines.reduce((n, l) => n + l.subtotal, 0),
  };
}

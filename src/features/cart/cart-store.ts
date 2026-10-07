import { create } from 'zustand';

import type { CartItem, MenuItem } from '@/mocks/types';

type CartState = {
  items: CartItem[];
  add: (item: MenuItem, quantity?: number, note?: string) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  clear: () => void;
};

/** One storefront at a time: adding from another quán starts a fresh cart. */
export const useCart = create<CartState>((set) => ({
  items: [],

  add: (item, quantity = 1, note) =>
    set((s) => {
      const sameStore = s.items.every((i) => i.storefrontId === item.storefrontId);
      const base = sameStore ? s.items : [];
      const existing = base.find((i) => i.menuItemId === item.id);
      if (existing) {
        return {
          items: base.map((i) =>
            i.menuItemId === item.id ? { ...i, quantity: i.quantity + quantity, note: note ?? i.note } : i,
          ),
        };
      }
      return { items: [...base, { menuItemId: item.id, storefrontId: item.storefrontId, quantity, note }] };
    }),

  setQuantity: (menuItemId, quantity) =>
    set((s) => ({
      items: quantity <= 0 ? s.items.filter((i) => i.menuItemId !== menuItemId) : s.items.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i)),
    })),

  clear: () => set({ items: [] }),
}));

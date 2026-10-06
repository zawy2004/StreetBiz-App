import { useCart } from '@/features/cart/cart-store';
import type { MenuItem } from '@/mocks/types';

const item = (id: string, storefrontId: string): MenuItem => ({
  id,
  storefrontId,
  name: id,
  price: 20000,
  description: '',
  categoryId: 'CAT-01',
  availability_status: 'AVAILABLE',
});

beforeEach(() => useCart.getState().clear());

describe('cart store', () => {
  it('adds an item and merges the quantity when added again', () => {
    useCart.getState().add(item('A', 'S1'));
    useCart.getState().add(item('A', 'S1'), 2);
    expect(useCart.getState().items).toEqual([{ menuItemId: 'A', storefrontId: 'S1', quantity: 3, note: undefined }]);
  });

  it('starts a fresh cart when an item from another storefront is added', () => {
    useCart.getState().add(item('A', 'S1'));
    useCart.getState().add(item('B', 'S2'));
    expect(useCart.getState().items.map((i) => i.menuItemId)).toEqual(['B']);
  });

  it('removes a line when its quantity drops to zero', () => {
    useCart.getState().add(item('A', 'S1'), 2);
    useCart.getState().setQuantity('A', 0);
    expect(useCart.getState().items).toHaveLength(0);
  });
});

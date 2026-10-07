import { Button } from '@/components/common/Button';
import { goTo } from '@/core/navigation/go';
import { formatVnd } from '@/utils/format';

import { useCartView } from './use-cart';

/** Footer shown on store screens while the cart has items. */
export function CartBar() {
  const cart = useCartView().data;
  if (!cart?.count) return null;
  return <Button label={`Xem giỏ hàng · ${cart.count} món · ${formatVnd(cart.total)}`} icon="cart-outline" onPress={() => goTo('/customer/cart')} />;
}

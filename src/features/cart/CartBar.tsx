import { Button } from '@/components/common/Button';
import { goTo } from '@/core/navigation/go';
import { formatVnd } from '@/utils/format';

import { useCartSummary } from './useCartSummary';

/** Footer shown on store screens while the cart has items. */
export function CartBar() {
  const { count, total } = useCartSummary();
  if (!count) return null;
  return <Button label={`Xem giỏ hàng · ${count} món · ${formatVnd(total)}`} onPress={() => goTo('/customer/cart')} />;
}

import { HeaderIconButton, HeaderPill } from '@/components/layout/AppHeader';
import { ThemeToggleButton } from '@/components/layout/ThemeControls';
import { requireAuth } from '@/core/auth/require-auth';
import { goTo } from '@/core/navigation/go';
import { useUnreadNotifications } from '@/features/account/use-account';
import { useCartView } from '@/features/cart/use-cart';
import { useAuthStore } from '@/store/auth-store';

function NotificationBell() {
  const unread = useUnreadNotifications();
  return <HeaderIconButton icon="bell-outline" label="Thông báo" badge={unread} onPress={() => goTo('/notifications')} />;
}

/**
 * Buyer header (StreetBiz-FE's ConsumerTopNav on a phone): guests get the
 * theme switch and a "Đăng nhập" button, signed-in buyers get cart and bell.
 */
export function CustomerHeaderActions() {
  const user = useAuthStore((s) => s.user);
  const cartCount = useCartView().data?.count ?? 0;

  const cart = <HeaderIconButton icon="cart-outline" label="Giỏ hàng" badge={cartCount} onPress={() => goTo('/customer/cart')} />;

  if (!user) {
    return (
      <>
        {cartCount ? cart : <ThemeToggleButton />}
        <HeaderPill label="Đăng nhập" onPress={() => requireAuth()} />
      </>
    );
  }
  return (
    <>
      {cart}
      <NotificationBell />
    </>
  );
}

/** Seller header (StreetBiz-FE's VendorTopBar, reduced to what fits on a phone). */
export function VendorHeaderActions() {
  return (
    <>
      <HeaderIconButton icon="qrcode-scan" label="Quét nhận hàng" onPress={() => goTo('/vendor/store/pickup')} />
      <NotificationBell />
    </>
  );
}

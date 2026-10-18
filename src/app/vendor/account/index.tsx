import { router, type Href } from 'expo-router';
import { Switch } from 'react-native';

import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { AccountScreen } from '@/features/account-management/AccountScreens';
import { useOrderAlertStore } from '@/features/orders/alerts/order-alert-store';
import { colors } from '@/theme';

const go = (href: string) => router.push(href as Href);

/** The vendor's account tab: the shared account screen plus the stall's own shortcuts. */
export default function AccountTab() {
  const alerts = useOrderAlertStore((s) => s.alerts);
  const setAlerts = useOrderAlertStore((s) => s.setAlerts);
  return (
    <AccountScreen>
      <ListGroup title="Hộ kinh doanh">
        <ListRow title="Hồ sơ đăng ký" subtitle="Đăng ký hộ kinh doanh, đổi địa chỉ" icon={{ sf: 'folder.fill', md: 'folder' }} onPress={() => go('/vendor/home/registrations')} />
        <ListRow title="Cửa hàng & thực đơn" subtitle="Gian hàng, món bán, doanh thu" icon={{ sf: 'storefront.fill', md: 'storefront' }} onPress={() => go('/vendor/home/store')} />
        <ListRow title="Giấy ATTP" subtitle="An toàn thực phẩm cho món bán" icon={{ sf: 'checkmark.shield.fill', md: 'verified_user' }} tint={colors.onLeaf} tileColor={colors.leafTint} onPress={() => go('/vendor/home/store/food-safety')} />
        <ListRow title="Hướng dẫn bắt đầu" subtitle="6 bước từ hồ sơ tới bán hàng" icon={{ sf: 'map.fill', md: 'map' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => go('/vendor/home/onboarding')} />
      </ListGroup>
      <ListGroup title="Thông báo" footer="Rung và hiện thông báo khi có đơn mới khách đã thanh toán.">
        <ListRow title="Thông báo của tôi" icon={{ sf: 'bell.fill', md: 'notifications' }} onPress={() => go('/notifications')} />
        <ListRow
          title="Báo đơn mới"
          icon={{ sf: 'bag.badge.plus', md: 'add_shopping_cart' }}
          chevron={false}
          accessory={<Switch value={alerts} onValueChange={setAlerts} trackColor={{ true: colors.cta, false: colors.line }} thumbColor={colors.white} accessibilityLabel="Báo đơn mới" />}
        />
      </ListGroup>
    </AccountScreen>
  );
}

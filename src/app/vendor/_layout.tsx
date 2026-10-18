import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useCanChat } from '@/features/chat/hooks/useChat';
import { useChatInboxFeed } from '@/features/chat/realtime/useChatRealtime';
import { useVendorOrderAlerts } from '@/features/orders/alerts/useVendorOrderAlerts';
import { colors } from '@/theme';

/**
 * Hộ kinh doanh: Trang chủ, Ô thuê, Đơn hàng, Tài chính, Tài khoản. Tin nhắn và Cửa hàng mở từ Trang chủ (web có 6 tab).
 * The platform's own tab bar (Material on Android, iOS tab bar), labels always shown,
 * tabs never slide, at most five (the web's longer lists are folded in, see master prompt v3 §8).
 */
export default function VendorTabs() {
  const newOrders = useVendorOrderAlerts();
  // Buyers' messages, live on every vendor screen (the unread count shows on Trang chủ).
  useChatInboxFeed(useCanChat());
  return (
    <NativeTabs tintColor={colors.cta} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="home" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Trang chủ</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="slots" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.3x3', selected: 'square.grid.3x3.fill' }} md="grid_view" />
        <NativeTabs.Trigger.Label>Ô thuê</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'bag', selected: 'bag.fill' }} md="receipt_long" />
        <NativeTabs.Trigger.Label>Đơn hàng</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={newOrders === 0}>{newOrders > 99 ? '99+' : String(newOrders)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="finance" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'banknote', selected: 'banknote.fill' }} md="payments" />
        <NativeTabs.Trigger.Label>Tài chính</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>Tài khoản</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

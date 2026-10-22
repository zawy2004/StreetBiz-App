import { Tabs } from 'expo-router';

import { useCanChat } from '@/features/chat/hooks/useChat';
import { useChatInboxFeed } from '@/features/chat/realtime/useChatRealtime';
import { useVendorOrderAlerts } from '@/features/orders/alerts/useVendorOrderAlerts';
import { tabIcon, tabLabel, tabScreenOptions } from '@/ui';

/**
 * Hộ kinh doanh: Trang chủ, Ô thuê, Đơn hàng, Tài chính, Tài khoản. Tin nhắn và Cửa hàng mở từ Trang chủ (web có 6 tab).
 * A bottom tab bar on every platform (see src/ui/bottom-tabs.tsx); labels always shown.
 */
export default function VendorTabs() {
  const newOrders = useVendorOrderAlerts();
  // Buyers' messages, live on every vendor screen (the unread count shows on Trang chủ).
  useChatInboxFeed(useCanChat());
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="home"
        options={{ tabBarLabel: tabLabel('Trang chủ'), tabBarIcon: tabIcon('house', 'house.fill', 'home') }}
      />
      <Tabs.Screen
        name="slots"
        options={{ tabBarLabel: tabLabel('Ô thuê'), tabBarIcon: tabIcon('square.grid.3x3', 'square.grid.3x3.fill', 'grid_view') }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          tabBarLabel: tabLabel('Đơn hàng'),
          tabBarIcon: tabIcon('bag', 'bag.fill', 'receipt_long'),
          tabBarBadge: newOrders > 0 ? (newOrders > 99 ? '99+' : newOrders) : undefined,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{ tabBarLabel: tabLabel('Tài chính'), tabBarIcon: tabIcon('banknote', 'banknote.fill', 'payments') }}
      />
      <Tabs.Screen
        name="account"
        options={{ tabBarLabel: tabLabel('Tài khoản'), tabBarIcon: tabIcon('person.crop.circle', 'person.crop.circle.fill', 'account_circle') }}
      />
    </Tabs>
  );
}

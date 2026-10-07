import { Tabs } from 'expo-router';

import { tabIcon, useTabScreenOptions } from '@/components/layout/tab-options';
import { useChatUnread } from '@/features/chat/use-chat';
import { useVendorOrders } from '@/features/orders/use-orders';
import { VendorHeaderActions } from '@/layouts/HeaderActions';

/** StreetBiz-FE's VENDOR_TABS: daily work (orders, messages) gets a tab, setup lives on the home screen. */
export default function VendorTabs() {
  const newOrders = (useVendorOrders().data ?? []).filter((o) => o.status === 'PLACED').length;
  const unreadChat = useChatUnread('VENDOR');
  const screenOptions = useTabScreenOptions(<VendorHeaderActions />);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="home" options={{ title: 'Trang chủ', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="slots" options={{ title: 'Ô thuê', tabBarIcon: tabIcon('map-marker-radius-outline', 'map-marker-radius') }} />
      <Tabs.Screen name="finance" options={{ title: 'Tài chính', tabBarIcon: tabIcon('cash-multiple') }} />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Đơn hàng', tabBarBadge: newOrders || undefined, tabBarIcon: tabIcon('receipt-text-outline', 'receipt-text') }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Tin nhắn', tabBarBadge: unreadChat || undefined, tabBarIcon: tabIcon('message-text-outline', 'message-text') }}
      />
      <Tabs.Screen name="account" options={{ title: 'Tài khoản', tabBarIcon: tabIcon('account-circle-outline', 'account-circle') }} />
    </Tabs>
  );
}

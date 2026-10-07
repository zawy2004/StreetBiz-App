import { Tabs } from 'expo-router';

import { tabIcon, useTabScreenOptions } from '@/components/layout/tab-options';

export default function VendorTabs() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="home" options={{ title: 'Trang chủ', tabBarIcon: tabIcon('storefront-outline') }} />
      <Tabs.Screen name="slots" options={{ title: 'Ô thuê', tabBarIcon: tabIcon('view-grid-outline') }} />
      <Tabs.Screen name="finance" options={{ title: 'Tài chính', tabBarIcon: tabIcon('receipt-text-outline') }} />
      <Tabs.Screen name="orders" options={{ title: 'Đơn hàng', tabBarIcon: tabIcon('clipboard-text-clock-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Tài khoản', tabBarIcon: tabIcon('card-account-details-outline') }} />
    </Tabs>
  );
}

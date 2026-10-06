import { Tabs } from 'expo-router';

import { tabIcon, useTabScreenOptions } from '@/components/layout/tab-options';

export default function CustomerTabs() {
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="explore" options={{ title: 'Khám phá', tabBarIcon: tabIcon('compass-outline') }} />
      <Tabs.Screen name="scan" options={{ title: 'Quét QR', tabBarIcon: tabIcon('qrcode-scan') }} />
      <Tabs.Screen name="orders" options={{ title: 'Đơn hàng', tabBarIcon: tabIcon('receipt-text-outline') }} />
      <Tabs.Screen name="chat" options={{ title: 'Tin nhắn', tabBarIcon: tabIcon('message-text-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Tài khoản', tabBarIcon: tabIcon('card-account-details-outline') }} />
    </Tabs>
  );
}

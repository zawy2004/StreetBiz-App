import { Tabs } from 'expo-router';

import { tabIcon, useTabScreenOptions } from '@/components/layout/tab-options';
import { useChatUnread } from '@/features/chat/use-chat';
import { CustomerHeaderActions } from '@/layouts/HeaderActions';
import { useAuthStore } from '@/store/auth-store';

/**
 * Same route group, two shells (StreetBiz-FE's CUSTOMER_TABS with `allowGuest`):
 * a guest sees Khám phá · Quét QR · Tài khoản; once signed in as a buyer the
 * Đơn hàng and Tin nhắn tabs appear.
 */
export default function CustomerTabs() {
  const user = useAuthStore((s) => s.user);
  const guest = !user;
  const unreadChat = useChatUnread('CUSTOMER');
  const screenOptions = useTabScreenOptions(<CustomerHeaderActions />);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="explore" options={{ title: 'Khám phá', tabBarIcon: tabIcon('compass-outline', 'compass') }} />
      <Tabs.Screen name="scan" options={{ title: 'Quét QR', tabBarIcon: tabIcon('qrcode-scan') }} />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Đơn hàng', href: guest ? null : undefined, tabBarIcon: tabIcon('receipt-text-outline', 'receipt-text') }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Tin nhắn',
          href: guest ? null : undefined,
          tabBarBadge: unreadChat || undefined,
          tabBarIcon: tabIcon('message-text-outline', 'message-text'),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: guest ? 'Khách' : 'Tài khoản', tabBarIcon: tabIcon('account-circle-outline', 'account-circle') }}
      />
    </Tabs>
  );
}

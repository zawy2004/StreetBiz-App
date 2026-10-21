import { Tabs } from 'expo-router';

import { useCanChat, useChatUnreadCount } from '@/features/chat/hooks/useChat';
import { useChatInboxFeed } from '@/features/chat/realtime/useChatRealtime';
import { tabIcon, tabLabel, tabScreenOptions } from '@/ui';

/**
 * Người mua (và khách): Khám phá, Quét QR, Đơn hàng, Tin nhắn, Tài khoản — đúng 5 tab như web.
 * A bottom tab bar on every platform (see src/ui/bottom-tabs.tsx); labels always shown.
 */
export default function CustomerTabs() {
  const canChat = useCanChat();
  useChatInboxFeed(canChat);
  const unread = useChatUnreadCount().data ?? 0;
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="explore"
        options={{ tabBarLabel: tabLabel('Khám phá'), tabBarIcon: tabIcon('safari', 'safari.fill', 'explore') }}
      />
      <Tabs.Screen
        name="scan"
        options={{ tabBarLabel: tabLabel('Quét QR'), tabBarIcon: tabIcon('qrcode.viewfinder', 'qrcode.viewfinder', 'qr_code_scanner') }}
      />
      <Tabs.Screen
        name="orders"
        options={{ tabBarLabel: tabLabel('Đơn hàng'), tabBarIcon: tabIcon('bag', 'bag.fill', 'receipt_long') }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          tabBarLabel: tabLabel('Tin nhắn'),
          tabBarIcon: tabIcon('bubble.left.and.bubble.right', 'bubble.left.and.bubble.right.fill', 'chat'),
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ tabBarLabel: tabLabel('Tài khoản'), tabBarIcon: tabIcon('person.crop.circle', 'person.crop.circle.fill', 'account_circle') }}
      />
    </Tabs>
  );
}

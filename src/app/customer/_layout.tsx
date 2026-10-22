import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useCanChat, useChatUnreadCount } from '@/features/chat/hooks/useChat';
import { useChatInboxFeed } from '@/features/chat/realtime/useChatRealtime';
import { tabBarLook } from '@/ui';

/**
 * Người mua (và khách): Khám phá, Quét QR, Đơn hàng, Tin nhắn, Tài khoản — đúng 5 tab như web.
 * The platform's own tab bar (Material on Android, iOS tab bar), labels always shown,
 * tabs never slide, at most five (the web's longer lists are folded in, see master prompt v3 §8).
 */
export default function CustomerTabs() {
  const canChat = useCanChat();
  useChatInboxFeed(canChat);
  const unread = useChatUnreadCount().data ?? 0;
  return (
    <NativeTabs {...tabBarLook} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="explore" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'safari', selected: 'safari.fill' }} md="explore" />
        <NativeTabs.Trigger.Label>Khám phá</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scan" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf="qrcode.viewfinder" md="qr_code_scanner" />
        <NativeTabs.Trigger.Label>Quét QR</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'bag', selected: 'bag.fill' }} md="receipt_long" />
        <NativeTabs.Trigger.Label>Đơn hàng</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} md="chat" />
        <NativeTabs.Trigger.Label>Tin nhắn</NativeTabs.Trigger.Label>
        {/* Only mounted with a count: Android draws hidden={true} as a "0" badge. */}
        {unread > 0 ? <NativeTabs.Trigger.Badge>{unread > 99 ? '99+' : String(unread)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>Tài khoản</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

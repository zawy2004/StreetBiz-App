import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/theme';

/**
 * Người mua (và khách): Khám phá, Quét QR, Đơn hàng, Tin nhắn, Tài khoản — đúng 5 tab như web.
 * The platform's own tab bar (Material on Android, iOS tab bar), labels always shown,
 * tabs never slide, at most five (the web's longer lists are folded in, see master prompt v3 §8).
 */
export default function CustomerTabs() {
  return (
    <NativeTabs tintColor={colors.cta} minimizeBehavior="onScrollDown">
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
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>Tài khoản</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

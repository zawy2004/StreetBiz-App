import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { tabBarLook } from '@/ui';

/**
 * Quản trị nền tảng: Tổng quan, Tài khoản, Danh mục, Kiểm duyệt, Cá nhân.
 * The platform's own tab bar (Material on Android, iOS tab bar), labels always shown,
 * tabs never slide, at most five (the web's longer lists are folded in, see master prompt v3 §8).
 */
export default function PlatformTabs() {
  return (
    <NativeTabs {...tabBarLook} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="dashboard" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="insights" />
        <NativeTabs.Trigger.Label>Tổng quan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="accounts" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        <NativeTabs.Trigger.Label>Tài khoản</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="categories" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }} md="category" />
        <NativeTabs.Trigger.Label>Danh mục</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="moderation" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'checkmark.shield', selected: 'checkmark.shield.fill' }} md="shield" />
        <NativeTabs.Trigger.Label>Kiểm duyệt</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>Cá nhân</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

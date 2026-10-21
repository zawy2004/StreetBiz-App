import { Tabs } from 'expo-router';

import { tabIcon, tabLabel, tabScreenOptions } from '@/ui';

/**
 * Quản trị nền tảng: Tổng quan, Tài khoản, Danh mục, Kiểm duyệt, Cá nhân.
 * Web-only on this release (not mounted — see src/app/_layout.tsx), kept in sync with the other
 * roles' bottom tab bar (see src/ui/bottom-tabs.tsx) for when it is restored.
 */
export default function PlatformTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="dashboard"
        options={{ tabBarLabel: tabLabel('Tổng quan'), tabBarIcon: tabIcon('chart.bar', 'chart.bar.fill', 'insights') }}
      />
      <Tabs.Screen
        name="accounts"
        options={{ tabBarLabel: tabLabel('Tài khoản'), tabBarIcon: tabIcon('person.2', 'person.2.fill', 'group') }}
      />
      <Tabs.Screen
        name="categories"
        options={{ tabBarLabel: tabLabel('Danh mục'), tabBarIcon: tabIcon('list.bullet.rectangle', 'list.bullet.rectangle.fill', 'category') }}
      />
      <Tabs.Screen
        name="moderation"
        options={{ tabBarLabel: tabLabel('Kiểm duyệt'), tabBarIcon: tabIcon('checkmark.shield', 'checkmark.shield.fill', 'shield') }}
      />
      <Tabs.Screen
        name="me"
        options={{ tabBarLabel: tabLabel('Cá nhân'), tabBarIcon: tabIcon('person.crop.circle', 'person.crop.circle.fill', 'account_circle') }}
      />
    </Tabs>
  );
}

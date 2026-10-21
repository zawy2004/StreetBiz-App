import { Tabs } from 'expo-router';

import { tabIcon, tabLabel, tabScreenOptions } from '@/ui';

/**
 * Cán bộ Phường: Tổng quan, Hộp duyệt, Tuần tra, Lưới ô, Thêm (thu phí, giá và khung giờ, báo cáo, tài khoản; web có 7 tab).
 * A bottom tab bar on every platform (see src/ui/bottom-tabs.tsx); labels always shown.
 */
export default function WardTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="dashboard"
        options={{ tabBarLabel: tabLabel('Tổng quan'), tabBarIcon: tabIcon('chart.bar', 'chart.bar.fill', 'insights') }}
      />
      <Tabs.Screen
        name="inbox"
        options={{ tabBarLabel: tabLabel('Hộp duyệt'), tabBarIcon: tabIcon('tray.full', 'tray.full.fill', 'inbox') }}
      />
      <Tabs.Screen
        name="patrol"
        options={{ tabBarLabel: tabLabel('Tuần tra'), tabBarIcon: tabIcon('qrcode.viewfinder', 'qrcode.viewfinder', 'qr_code_scanner') }}
      />
      <Tabs.Screen
        name="slots"
        options={{ tabBarLabel: tabLabel('Lưới ô'), tabBarIcon: tabIcon('square.grid.3x3', 'square.grid.3x3.fill', 'grid_view') }}
      />
      <Tabs.Screen
        name="more"
        options={{ tabBarLabel: tabLabel('Thêm'), tabBarIcon: tabIcon('ellipsis.circle', 'ellipsis.circle.fill', 'more_horiz') }}
      />
    </Tabs>
  );
}

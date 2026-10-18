import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/theme';

/**
 * Cán bộ Phường: Tổng quan, Hộp duyệt, Tuần tra, Lưới ô, Thêm (thu phí, giá và khung giờ, báo cáo, tài khoản; web có 7 tab).
 * The platform's own tab bar (Material on Android, iOS tab bar), labels always shown,
 * tabs never slide, at most five (the web's longer lists are folded in, see master prompt v3 §8).
 */
export default function WardTabs() {
  return (
    <NativeTabs tintColor={colors.cta} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="dashboard" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="insights" />
        <NativeTabs.Trigger.Label>Tổng quan</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inbox" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'tray.full', selected: 'tray.full.fill' }} md="inbox" />
        <NativeTabs.Trigger.Label>Hộp duyệt</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="patrol" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf="qrcode.viewfinder" md="qr_code_scanner" />
        <NativeTabs.Trigger.Label>Tuần tra</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="slots" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.3x3', selected: 'square.grid.3x3.fill' }} md="grid_view" />
        <NativeTabs.Trigger.Label>Lưới ô</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more" labelVisibilityMode="labeled">
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} md="more_horiz" />
        <NativeTabs.Trigger.Label>Thêm</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

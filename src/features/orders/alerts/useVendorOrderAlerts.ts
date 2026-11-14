import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';

import { showToast } from '@/components/feedback/Toast';
import { useVendorOrderCounts } from '../hooks/useOrders';
import { useVendorOrderFeed } from '../realtime/useVendorOrderFeed';
import { useOrderAlertStore } from './order-alert-store';

const PLACED = ['PLACED'] as const;

/**
 * The app's version of the web's vendor order alerts: the live order socket while the vendor
 * tabs are up, and a buzz plus a toast whenever the count of new (paid, not yet accepted)
 * orders grows. Returns that count for the tab badge.
 */
export function useVendorOrderAlerts(): number {
  useVendorOrderFeed(true);
  const alerts = useOrderAlertStore((s) => s.alerts);
  const placed = useVendorOrderCounts(PLACED).PLACED;
  const previous = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (placed == null) return;
    const before = previous.current;
    previous.current = placed;
    if (before != null && placed > before && alerts) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast(placed - before === 1 ? 'Có 1 đơn mới đang chờ nhận' : `Có ${placed - before} đơn mới đang chờ nhận`, 'info');
    }
  }, [placed, alerts]);
  return placed ?? 0;
}

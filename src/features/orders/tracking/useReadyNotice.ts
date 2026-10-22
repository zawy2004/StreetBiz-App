import { useEffect, useRef } from 'react';

import * as Haptics from 'expo-haptics';

import { showToast } from '@/components/feedback/Toast';
import type { OrderStatus } from '../types/order.types';

/**
 * One gentle nudge when an order turns ready while the customer is looking at it (the realtime
 * push or a poll changed it). Not on first load: an order that was already ready is not news.
 * A short buzz on phones that support it, since a phone in a pocket shows no toast.
 */
export function useReadyNotice(status: OrderStatus | undefined) {
  const previous = useRef<OrderStatus | undefined>(undefined);
  useEffect(() => {
    if (previous.current && previous.current !== status && status === 'READY_FOR_PICKUP') {
      showToast('Món của bạn đã sẵn sàng. Mời bạn đến quầy lấy món!');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    previous.current = status;
  }, [status]);
}

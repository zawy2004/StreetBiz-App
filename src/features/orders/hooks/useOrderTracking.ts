import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isLiveApi } from '@/core/config/env';
import { orderApi } from '../api/orderApi';
import type { OrderStatus } from '../types/order.types';
import { orderKeys } from './useOrders';

/**
 * ORD-02: the estimate and queue for one customer order. Keyed under the order's detail key, so
 * the realtime `OrderUpdated` push that refreshes the detail refreshes this too; the status is part
 * of the key, so each step change reads a fresh estimate without polling.
 */
export function useOrderTracking(orderId: number | undefined, status: OrderStatus | undefined) {
  return useQuery({
    queryKey: [...orderKeys.customerDetail(orderId ?? ''), 'tracking', status ?? ''] as const,
    queryFn: () => orderApi.tracking(orderId!),
    enabled: isLiveApi && Boolean(orderId) && Boolean(status),
    staleTime: 30_000,
    // Keep the last estimate on screen while the next step's loads: no flash of emptiness.
    placeholderData: keepPreviousData,
  });
}

/** "Tôi đang đến": refreshes the tracking query so the card shows when the stall was told. */
export function useAnnounceArrival(orderId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (etaMinutes?: number) => orderApi.announceArrival(orderId!, etaMinutes),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...orderKeys.customerDetail(orderId ?? ''), 'tracking'] }),
  });
}

/** The stall answers "Đã thấy": the board re-reads at once so the button gives way to the answer. */
export function useAcknowledgeArrival() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) => orderApi.acknowledgeArrival(orderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'vendor', 'arrivals'] }),
  });
}

/** How often the seller's board re-reads who is on the way (the same cadence as its order list). */
export const VENDOR_ARRIVALS_REFRESH_MS = 20_000;

/** Customers on their way to collect, keyed by order id, for the seller's tickets. */
export function useVendorArrivals(enabled = true) {
  const query = useQuery({
    queryKey: ['orders', 'vendor', 'arrivals'] as const,
    queryFn: orderApi.vendorArrivals,
    enabled: isLiveApi && enabled,
    refetchInterval: VENDOR_ARRIVALS_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
  return new Map((query.data ?? []).map((arrival) => [arrival.orderId, arrival]));
}

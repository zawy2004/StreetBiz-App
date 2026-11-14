import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { ApiError } from '@/core/api/problem';
import { orderApi } from '../api/orderApi';
import {
  TERMINAL_ORDER_STATUSES,
  type Order,
  type OrderListFilters,
  type OrderStatus,
  type PickupLocation,
} from '../types/order.types';
import { useOrderRealtime } from '../realtime/useOrderRealtime';

export const orderKeys = {
  customerLists: ['orders', 'customer', 'list'] as const,
  customerList: (filters: OrderListFilters) => [...orderKeys.customerLists, filters] as const,
  customerDetail: (id: string | number) => ['orders', 'customer', 'detail', String(id)] as const,
  vendorLists: ['orders', 'vendor', 'list'] as const,
  vendorList: (filters: OrderListFilters) => [...orderKeys.vendorLists, filters] as const,
  vendorDetail: (id: string | number) => ['orders', 'vendor', 'detail', String(id)] as const,
  sales: (from: string, to: string, groupBy: string) =>
    ['orders', 'vendor', 'sales', from, to, groupBy] as const,
};

export function orderPollingInterval(order?: Order): number | false {
  return !order || TERMINAL_ORDER_STATUSES.has(order.orderStatus) ? false : 7_000;
}

/**
 * Keeps the page on screen while the next one loads, so paging does not flash
 * a skeleton. Only within one tab: after a tab switch the old tab's orders
 * would be shown under the new tab's name.
 */
function keepWhilePaging<T>(filters: OrderListFilters) {
  return (previous: T | undefined, previousQuery?: { queryKey: readonly unknown[] }) => {
    const before = previousQuery?.queryKey.at(-1) as OrderListFilters | undefined;
    return before && String(before.status) === String(filters.status) ? previous : undefined;
  };
}

export function useCustomerOrders(filters: OrderListFilters, enabled = true) {
  return useQuery({
    queryKey: orderKeys.customerList(filters),
    queryFn: () => orderApi.customerOrders(filters),
    enabled,
    placeholderData: keepWhilePaging(filters),
  });
}

export function useCustomerOrder(orderId: string | number | undefined) {
  const realtimeConnected = useRef(false);
  const query = useQuery({
    queryKey: orderKeys.customerDetail(orderId ?? ''),
    queryFn: () => orderApi.customerOrder(orderId!),
    enabled: Boolean(orderId),
    refetchInterval: (state) =>
      realtimeConnected.current ? false : orderPollingInterval(state.state.data),
    refetchIntervalInBackground: false,
  });
  const connected = useOrderRealtime(
    orderId,
    'customer',
    Boolean(query.data && !TERMINAL_ORDER_STATUSES.has(query.data.orderStatus)),
  );
  useEffect(() => {
    realtimeConnected.current = connected;
  }, [connected]);
  return query;
}

/**
 * How often a seller's order list re-reads itself. New orders land while the
 * seller is cooking, not while they are pressing "refresh".
 */
export const VENDOR_ORDERS_REFRESH_MS = 20_000;

export function useVendorOrders(filters: OrderListFilters) {
  return useQuery({
    queryKey: orderKeys.vendorList(filters),
    queryFn: () => orderApi.vendorOrders(filters),
    placeholderData: keepWhilePaging(filters),
    refetchInterval: VENDOR_ORDERS_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

/**
 * How many orders wait at each stage. A one-row page per status: the total is
 * all that is read, and the list endpoint already filters each status in the
 * database. Keyed under the vendor lists, so every order change recounts.
 */
export function useVendorOrderCounts(statuses: readonly OrderStatus[]) {
  const results = useQueries({
    queries: statuses.map((status) => {
      const filters: OrderListFilters = { status, page: 1, pageSize: 1 };
      return {
        queryKey: orderKeys.vendorList(filters),
        queryFn: () => orderApi.vendorOrders(filters),
        refetchInterval: VENDOR_ORDERS_REFRESH_MS,
        refetchIntervalInBackground: false,
      };
    }),
  });
  return Object.fromEntries(
    statuses.map((status, index) => [status, results[index]?.data?.totalItems]),
  ) as Partial<Record<OrderStatus, number>>;
}

export function useVendorOrder(orderId: string | number | undefined) {
  const realtimeConnected = useRef(false);
  const query = useQuery({
    queryKey: orderKeys.vendorDetail(orderId ?? ''),
    queryFn: () => orderApi.vendorOrder(orderId!),
    enabled: Boolean(orderId),
    refetchInterval: (state) =>
      realtimeConnected.current ? false : orderPollingInterval(state.state.data),
    refetchIntervalInBackground: false,
  });
  const connected = useOrderRealtime(
    orderId,
    'vendor',
    Boolean(query.data && !TERMINAL_ORDER_STATUSES.has(query.data.orderStatus)),
  );
  useEffect(() => {
    realtimeConnected.current = connected;
  }, [connected]);
  return query;
}

export function useRefreshAfterOrderMutation(scope: 'customer' | 'vendor', orderId: number) {
  const cache = useQueryClient();
  const listKey = scope === 'customer' ? orderKeys.customerLists : orderKeys.vendorLists;
  const detailKey =
    scope === 'customer' ? orderKeys.customerDetail(orderId) : orderKeys.vendorDetail(orderId);
  return {
    update: async (order: Order) => {
      cache.setQueryData(detailKey, order);
      await cache.invalidateQueries({ queryKey: listKey });
    },
    handleError: async (error: unknown) => {
      if (error instanceof ApiError && error.status === 409) {
        await Promise.all([
          cache.invalidateQueries({ queryKey: listKey }),
          cache.invalidateQueries({ queryKey: detailKey }),
        ]);
      }
    },
  };
}

export function useCheckoutOrder() {
  return useMutation({
    mutationFn: ({
      cartId,
      provider,
      idempotencyKey,
      location,
    }: {
      cartId: number;
      provider: 'MOMO' | 'ZALOPAY';
      idempotencyKey: string;
      /** ORD-01: where the customer is; the server re-checks the pickup range against it. */
      location?: PickupLocation;
    }) => orderApi.checkout({ cartId, provider, location }, idempotencyKey),
  });
}

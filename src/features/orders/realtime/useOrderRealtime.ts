import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getAccessToken } from '@/core/api/token-storage';
import { env, isLiveApi } from '@/core/config/env';
import type { OrderStatus } from '../types/order.types';

type OrderScope = 'customer' | 'vendor';

type OrderUpdatedMessage = {
  orderId: number;
  orderStatus: OrderStatus;
  changedAtUtc: string;
};

export function getOrderHubUrl(apiBaseUrl = env.apiBaseUrl): string {
  // The API address is absolute on a phone: strip a trailing /api and point at the hub.
  return `${apiBaseUrl.replace(/\/$/, '').replace(/\/api$/, '')}/hubs/orders`;
}

export function useOrderRealtime(
  orderId: string | number | undefined,
  scope: OrderScope,
  enabled: boolean,
): boolean {
  const cache = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Off: nothing to do. The previous run's cleanup already marked the socket down.
    if (!enabled || !orderId || !isLiveApi || process.env.NODE_ENV === 'test') return;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const numericOrderId = Number(orderId);
    const detailKey = ['orders', scope, 'detail', String(orderId)] as const;
    const listKey = ['orders', scope, 'list'] as const;

    const onOrderUpdated = (message: OrderUpdatedMessage) => {
      if (message.orderId !== numericOrderId) return;
      void Promise.all([
        cache.invalidateQueries({ queryKey: detailKey }),
        cache.invalidateQueries({ queryKey: listKey }),
        ...(scope === 'vendor'
          ? [cache.invalidateQueries({ queryKey: ['orders', 'vendor', 'sales'] })]
          : []),
      ]);
    };

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(getOrderHubUrl(), {
        accessTokenFactory: () => getAccessToken() ?? '',
        // See useChatRealtime: the API sends no Access-Control-Allow-Credentials,
        // so a credentialed negotiate is blocked by CORS before it reaches the hub.
        withCredentials: false,
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .configureLogging(LogLevel.Critical)
      .build();

    connection.on('OrderUpdated', onOrderUpdated);
    connection.onreconnecting(() => setConnected(false));
    connection.onreconnected(async () => {
      if (disposed) return;
      try {
        await connection.invoke('SubscribeOrder', numericOrderId);
        setConnected(true);
      } catch {
        setConnected(false);
      }
    });
    connection.onclose(() => setConnected(false));

    const start = async () => {
      try {
        await connection.start();
        if (disposed) {
          await connection.stop();
          return;
        }
        await connection.invoke('SubscribeOrder', numericOrderId);
        setConnected(true);
      } catch {
        setConnected(false);
        if (connection.state !== HubConnectionState.Disconnected) {
          await connection.stop().catch(() => undefined);
        }
        if (!disposed) retryTimer = setTimeout(() => void start(), 10_000);
      }
    };

    void start();
    return () => {
      disposed = true;
      setConnected(false);
      if (retryTimer) clearTimeout(retryTimer);
      connection.off('OrderUpdated', onOrderUpdated);
      if (connection.state === HubConnectionState.Connected) {
        void connection
          .invoke('UnsubscribeOrder', numericOrderId)
          .catch(() => undefined)
          .finally(() => connection.stop());
      } else {
        void connection.stop();
      }
    };
  }, [cache, enabled, orderId, scope]);

  return connected;
}

import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getAccessToken } from '@/core/api/token-storage';
import { isLiveApi } from '@/core/config/env';
import { useOrderAlertStore } from '../alerts/order-alert-store';
import { getOrderHubUrl } from './useOrderRealtime';

/**
 * The seller's whole board, live: one socket for every vendor screen, told by
 * the server whenever any of their orders changes - a new order paid, one
 * accepted on another device, one cancelled by the buyer.
 *
 * The message carries no order data. It only says "look again": every vendor
 * order query is refetched over HTTP, so what the seller sees is always what
 * the database says, and polling still covers any gap while the socket is down.
 */
export function useVendorOrderFeed(enabled: boolean) {
  const cache = useQueryClient();
  const setLive = useOrderAlertStore((state) => state.setLive);

  useEffect(() => {
    if (!enabled || !isLiveApi || process.env.NODE_ENV === 'test') {
      setLive(false);
      return;
    }

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => cache.invalidateQueries({ queryKey: ['orders', 'vendor'] });

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(getOrderHubUrl(), {
        accessTokenFactory: () => getAccessToken() ?? '',
        // See useChatRealtime: the API sends no Access-Control-Allow-Credentials.
        withCredentials: false,
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Critical)
      .build();

    connection.on('VendorOrderChanged', () => void refresh());
    connection.onreconnecting(() => setLive(false));
    connection.onreconnected(async () => {
      if (disposed) return;
      try {
        await connection.invoke('SubscribeVendorOrders');
        setLive(true);
        // Whatever happened while the socket was down is only in the database.
        await refresh();
      } catch {
        setLive(false);
      }
    });
    connection.onclose(() => setLive(false));

    const start = async () => {
      try {
        await connection.start();
        if (disposed) {
          await connection.stop();
          return;
        }
        await connection.invoke('SubscribeVendorOrders');
        setLive(true);
      } catch {
        setLive(false);
        if (connection.state !== HubConnectionState.Disconnected) {
          await connection.stop().catch(() => undefined);
        }
        if (!disposed) retryTimer = setTimeout(() => void start(), 15_000);
      }
    };

    void start();
    return () => {
      disposed = true;
      setLive(false);
      if (retryTimer) clearTimeout(retryTimer);
      if (connection.state === HubConnectionState.Connected) {
        void connection
          .invoke('UnsubscribeVendorOrders')
          .catch(() => undefined)
          .finally(() => connection.stop());
      } else {
        void connection.stop();
      }
    };
  }, [cache, enabled, setLive]);
}

import { apiGet, apiPost } from '@/core/api/client';
import type {
  ArrivalAck,
  ArrivalNotice,
  CheckoutRequest,
  CheckoutResponse,
  Order,
  OrderItem,
  OrderPickupCode,
  OrderListFilters,
  OrderStatusHistory,
  OrderArrival,
  OrderTracking,
  PagedResult,
  PickupRangeInfo,
  SalesGroup,
  SalesSummary,
} from '../types/order.types';

type BackendOrder = Partial<Order> & {
  storefrontId?: number;
  storefrontName?: string;
  storefrontImageUrl?: string | null;
  storefrontAddress?: string | null;
  history?: OrderStatusHistory[];
};

function normalizeUtc(value?: string | null): string | null {
  if (!value) return null;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    return new Date(value).toISOString();
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) return value;
  const [, year, month, day, hour, minute, second, fraction = '0'] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(fraction.padEnd(3, '0').slice(0, 3)),
    ),
  ).toISOString();
}

export function mapOrder(input: BackendOrder): Order {
  const storefront = input.storefront ?? {
    storefrontId: input.storefrontId ?? 0,
    storefrontName: input.storefrontName ?? '',
    imageUrl: input.storefrontImageUrl ?? null,
    address: input.storefrontAddress ?? null,
  };
  const items = (input.items ?? []).map((item): OrderItem => ({
    ...item,
    lineTotal: item.lineTotal ?? item.unitPrice * item.quantity,
  }));
  const statusHistory = (input.statusHistory ?? input.history ?? []).map(
    (history): OrderStatusHistory => ({
      ...history,
      changedAt: normalizeUtc(history.changedAt) ?? history.changedAt,
    }),
  );
  return {
    orderId: input.orderId!,
    orderCode: input.orderCode!,
    customerUserId: input.customerUserId,
    customerName: input.customerName,
    orderStatus: input.orderStatus!,
    storefront,
    items,
    subtotalAmount: input.subtotalAmount ?? 0,
    totalAmount: input.totalAmount ?? 0,
    rejectionReason: input.rejectionReason,
    paymentProvider: input.paymentProvider,
    paymentStatus: input.paymentStatus,
    refundAmount: input.refundAmount,
    refundReason: input.refundReason,
    refundStatus: input.refundStatus,
    refundRequestedAt: normalizeUtc(input.refundRequestedAt),
    refundCompletedAt: normalizeUtc(input.refundCompletedAt),
    placedAt: normalizeUtc(input.placedAt),
    completedAt: normalizeUtc(input.completedAt),
    createdAt: normalizeUtc(input.createdAt) ?? input.createdAt!,
    statusHistory,
  };
}

function query(filters: OrderListFilters): string {
  const params = new URLSearchParams();
  // A list is sent as one comma-separated value and filtered before paging, so
  // the page count is about the tab rather than about every order.
  const status = typeof filters.status === 'string' ? filters.status : filters.status?.join(',');
  if (status) params.set('status', status);
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 20));
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  params.set('sort', filters.sort ?? 'createdAt_desc');
  return params.toString();
}

function mapPage(page: PagedResult<BackendOrder>): PagedResult<Order> {
  return { ...page, items: page.items.map(mapOrder) };
}

export const orderApi = {
  checkout: (request: CheckoutRequest, idempotencyKey: string) =>
    apiPost<CheckoutResponse>('/orders/checkout', request, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  customerOrders: async (filters: OrderListFilters = {}) =>
    mapPage(await apiGet<PagedResult<BackendOrder>>(`/orders/me?${query(filters)}`)),
  customerOrder: async (orderId: string | number) =>
    mapOrder(await apiGet<BackendOrder>(`/orders/${orderId}`)),
  cancel: async (orderId: number) =>
    mapOrder(await apiPost<BackendOrder>(`/orders/${orderId}/cancel`)),
  /** Backend asks the payment provider (MoMo) for the real state and applies it. */
  syncPayment: async (orderId: number) =>
    mapOrder(await apiPost<BackendOrder>(`/orders/${orderId}/payment/sync`)),
  /** Development sandbox only: the backend 404s these outside Development. */
  confirmSandboxPayment: async (orderId: number) =>
    mapOrder(await apiPost<BackendOrder>(`/orders/${orderId}/payment/sandbox-confirm`)),
  failSandboxPayment: async (orderId: number) =>
    mapOrder(await apiPost<BackendOrder>(`/orders/${orderId}/payment/sandbox-fail`)),
  /** ORD-06: the signed code the buyer shows at the stall. */
  pickupCode: (orderId: number | string) =>
    apiGet<OrderPickupCode>(`/orders/${orderId}/pickup-code`),
  /** ORD-02: ready-time estimate, queue ahead and where to collect. */
  tracking: async (orderId: number | string): Promise<OrderTracking> => {
    const tracking = await apiGet<OrderTracking>(`/orders/${orderId}/tracking`);
    const estimate = tracking.readyEstimate;
    return {
      ...tracking,
      readyAt: normalizeUtc(tracking.readyAt),
      arrivalNotifiedAt: normalizeUtc(tracking.arrivalNotifiedAt),
      arrivalAcknowledgedAt: normalizeUtc(tracking.arrivalAcknowledgedAt),
      readyEstimate: estimate && {
        ...estimate,
        earliestReadyAt: normalizeUtc(estimate.earliestReadyAt),
        latestReadyAt: normalizeUtc(estimate.latestReadyAt),
      },
    };
  },
  /** ORD-01: the stall's pickup point and the range rule the server applies at checkout. */
  pickupRange: (storefrontId: number | string) =>
    apiGet<PickupRangeInfo>(`/marketplace/storefronts/${storefrontId}/pickup-range`),
  /** "Tôi đang đến": tells the stall the customer is on the way, with a walking ETA if known. */
  announceArrival: async (orderId: number, etaMinutes?: number): Promise<ArrivalNotice> => {
    const notice = await apiPost<ArrivalNotice>(`/orders/${orderId}/arriving`, {
      etaMinutes: etaMinutes ?? null,
    });
    return { ...notice, notifiedAt: normalizeUtc(notice.notifiedAt) ?? notice.notifiedAt };
  },
  /** The seller's board: customers on their way to collect. */
  vendorArrivals: async (): Promise<OrderArrival[]> =>
    (await apiGet<OrderArrival[]>('/vendor/orders/arrivals')).map((arrival) => ({
      ...arrival,
      notifiedAt: normalizeUtc(arrival.notifiedAt) ?? arrival.notifiedAt,
      acknowledgedAt: normalizeUtc(arrival.acknowledgedAt),
    })),
  /** The stall tells the customer "Đã thấy": the notice was read. */
  acknowledgeArrival: async (orderId: number): Promise<ArrivalAck> => {
    const ack = await apiPost<ArrivalAck>(`/vendor/orders/${orderId}/arrival-seen`);
    return { ...ack, acknowledgedAt: normalizeUtc(ack.acknowledgedAt) ?? ack.acknowledgedAt };
  },

  vendorOrders: async (filters: OrderListFilters = {}) =>
    mapPage(await apiGet<PagedResult<BackendOrder>>(`/vendor/orders?${query(filters)}`)),
  vendorOrder: async (orderId: string | number) =>
    mapOrder(await apiGet<BackendOrder>(`/vendor/orders/${orderId}`)),
  accept: async (orderId: number) =>
    mapOrder(await apiPost<BackendOrder>(`/vendor/orders/${orderId}/accept`)),
  reject: async (orderId: number, reason: string) =>
    mapOrder(await apiPost<BackendOrder>(`/vendor/orders/${orderId}/reject`, { reason })),
  preparing: async (orderId: number) =>
    mapOrder(await apiPost<BackendOrder>(`/vendor/orders/${orderId}/preparing`)),
  readyForPickup: async (orderId: number) =>
    mapOrder(await apiPost<BackendOrder>(`/vendor/orders/${orderId}/ready-for-pickup`)),
  /** ORD-06: the code identifies the order, so no order id is sent. */
  scanPickup: async (token: string) =>
    mapOrder(await apiPost<BackendOrder>('/vendor/orders/pickup-scan', { token })),

  /** ORD-06 fallback: the seller types the code the buyer reads out. */
  confirmPickupByCode: async (code: string) =>
    mapOrder(await apiPost<BackendOrder>('/vendor/orders/pickup-confirm', { code })),

  /**
   * ORD-06 last resort: no code could be read at all. The reason is required and
   * goes into the order's status history, which the buyer sees.
   */
  handoverWithoutCode: async (orderId: number, reason: string) =>
    mapOrder(
      await apiPost<BackendOrder>(`/vendor/orders/${orderId}/handover-without-code`, { reason }),
    ),
  salesSummary: (fromDate: string, toDate: string, groupBy: SalesGroup) => {
    const params = new URLSearchParams({ fromDate, toDate, groupBy });
    return apiGet<SalesSummary>(`/vendor/orders/sales-summary?${params.toString()}`);
  },
};

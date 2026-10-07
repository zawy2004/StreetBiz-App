import { customerOrdersApi, vendorOrdersApi, type ApiOrder, type PaymentProvider } from '@/core/api/commerce-api';
import { idempotencyKey, useDualMutation, useDualQuery } from '@/core/api/dual';
import { ApiError } from '@/core/api/problem';
import { useCart } from '@/features/cart/cart-store';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { useMockDb } from '@/mocks/db';
import type { Order } from '@/mocks/types';
import { useAuthStore } from '@/store/auth-store';

export type OrderView = {
  id: string;
  code: string;
  status: string;
  storefrontId: string;
  storefrontName: string;
  customerName?: string;
  items: { id: string; name: string; price: number; quantity: number; note?: string }[];
  total: number;
  createdAt: string;
  completedAt?: string;
  paymentProvider?: string;
  paymentStatus?: string;
  rejectionReason?: string;
  refundStatus?: string;
  refundAmount?: number;
  pickupTime?: string;
  note?: string;
  history: { status: string; at: string; note?: string }[];
};

export function fromApiOrder(o: ApiOrder): OrderView {
  return {
    id: String(o.orderId),
    code: o.orderCode,
    status: o.orderStatus,
    storefrontId: String(o.storefrontId),
    storefrontName: o.storefrontName,
    customerName: o.customerName,
    items: o.items.map((i) => ({ id: String(i.orderItemId), name: i.itemName, price: i.unitPrice, quantity: i.quantity, note: i.note ?? undefined })),
    total: o.totalAmount,
    createdAt: o.createdAt,
    completedAt: o.completedAt ?? undefined,
    paymentProvider: o.paymentProvider ?? undefined,
    paymentStatus: o.paymentStatus ?? undefined,
    rejectionReason: o.rejectionReason ?? undefined,
    refundStatus: o.refundStatus ?? undefined,
    refundAmount: o.refundAmount ?? undefined,
    history: (o.history ?? []).map((h) => ({ status: h.toStatus, at: h.changedAt, note: h.note ?? undefined })),
  };
}

function fromMockOrder(o: Order, storefrontName: string, customerName?: string): OrderView {
  return {
    id: o.id,
    code: o.order_code,
    status: o.order_status,
    storefrontId: o.storefrontId,
    storefrontName,
    customerName,
    items: o.items.map((i) => ({ id: i.menuItemId, name: i.name, price: i.price, quantity: i.quantity })),
    total: o.total,
    createdAt: o.created_at,
    completedAt: o.order_status === 'COMPLETED' ? o.created_at : undefined,
    paymentProvider: o.payment_method,
    pickupTime: o.pickup_time,
    note: o.note,
    history: [],
  };
}

function useMockOrderViews(filter: (o: Order) => boolean): OrderView[] {
  const orders = useMockDb((s) => s.orders);
  const stores = useMockDb((s) => s.storefronts);
  const users = useMockDb((s) => s.users);
  return orders
    .filter(filter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((o) => fromMockOrder(o, stores.find((s) => s.id === o.storefrontId)?.name ?? '', users.find((u) => u.id === o.customerId)?.fullName));
}

// ---- Buyer -------------------------------------------------------------------

export function useMyOrders() {
  const userId = useAuthStore((s) => s.user?.id);
  const mock = useMockOrderViews((o) => o.customerId === userId);
  return useDualQuery({
    key: ['orders', userId, 'mine'],
    live: async () => (await customerOrdersApi.list()).items.map(fromApiOrder),
    mock,
    enabled: Boolean(userId),
  });
}

/** One buyer order; polls while it can still change, so the status moves on its own. */
export function useMyOrder(orderId: string | undefined, poll = false) {
  const userId = useAuthStore((s) => s.user?.id);
  const mock = useMockOrderViews((o) => o.id === orderId)[0] ?? null;
  return useDualQuery({
    key: ['orders', userId, 'one', orderId],
    live: async () => fromApiOrder(await customerOrdersApi.get(orderId!)),
    mock,
    enabled: Boolean(orderId),
    refetchInterval: poll ? 5_000 : undefined,
  });
}

export function useCancelOrder() {
  return useDualMutation<string, void>({
    live: async (id) => void (await customerOrdersApi.cancel(id)),
    mock: (id) => useMockDb.getState().cancelOrder(id),
    invalidate: [['orders'], ['cart']],
  });
}

/** ORD-06: the code the buyer shows at the stall. The demo uses the order code itself. */
export function usePickupCode(order: OrderView | null | undefined, enabled: boolean) {
  return useDualQuery({
    key: ['orders', 'pickup-code', order?.id],
    live: async () => {
      const c = await customerOrdersApi.pickupCode(order!.id);
      return { qr: c.token, shortCode: c.shortCode };
    },
    mock: order ? { qr: order.code, shortCode: order.code } : null,
    enabled: Boolean(order) && enabled,
  });
}

export function usePaymentOptions() {
  return useDualQuery({
    key: ['orders', 'payment-options'],
    live: () => customerOrdersApi.paymentOptions(),
    mock: { mode: 'SANDBOX' as const, providers: ['MOMO', 'ZALOPAY'] as PaymentProvider[], message: 'Thanh toán mô phỏng (dữ liệu demo).' },
  });
}

/**
 * CART-02/ORD-01: turns the cart into an order awaiting payment. Live returns
 * the provider's payment page; the order only counts once the backend sees the
 * payment (callback, sync or the Development sandbox).
 */
export function useCheckout() {
  return useDualMutation<{ cartId?: string; provider: PaymentProvider; pickupTime?: string; note?: string }, { orderId: string; paymentUrl?: string }>({
    live: async ({ cartId, provider }) => {
      if (!cartId) throw new ApiError('validation_error', 400, 'Giỏ hàng trống.');
      const r = await customerOrdersApi.checkout(Number(cartId), provider, idempotencyKey());
      return { orderId: String(r.orderId), paymentUrl: r.paymentUrl || undefined };
    },
    mock: ({ provider, pickupTime, note }) => {
      const user = useAuthStore.getState().user;
      const db = useMockDb.getState();
      const items = useCart.getState().items;
      if (!user || !items.length) throw new ApiError('validation_error', 400, 'Giỏ hàng trống.');
      const lines = items.flatMap((i) => {
        const m = db.menuItems.find((x) => x.id === i.menuItemId);
        return m ? [{ menuItemId: m.id, name: m.name, price: m.price, quantity: i.quantity }] : [];
      });
      const order = db.placeOrder({
        customerId: user.id,
        storefrontId: items[0]!.storefrontId,
        items: lines,
        total: lines.reduce((n, l) => n + l.price * l.quantity, 0),
        pickup_time: pickupTime,
        note,
        payment_method: provider,
      });
      db.updateOrderStatus(order.id, 'PENDING_PAYMENT');
      useCart.getState().clear();
      return { orderId: order.id };
    },
    invalidate: [['orders'], ['cart']],
  });
}

/** Development sandbox: pretend the provider confirmed (or declined) the payment. */
export function useSandboxPay() {
  return useDualMutation<{ orderId: string; outcome: 'success' | 'fail' }, void>({
    live: async ({ orderId, outcome }) =>
      void (outcome === 'success' ? await customerOrdersApi.sandboxConfirm(orderId) : await customerOrdersApi.sandboxFail(orderId)),
    mock: ({ orderId, outcome }) =>
      outcome === 'success' ? useMockDb.getState().updateOrderStatus(orderId, 'PLACED') : useMockDb.getState().cancelOrder(orderId),
    invalidate: [['orders'], ['cart']],
  });
}

/** Back from the payment page: ask the backend for the real payment state. */
export function useSyncPayment() {
  return useDualMutation<string, OrderView | null>({
    live: async (orderId) => fromApiOrder(await customerOrdersApi.syncPayment(orderId)),
    mock: () => null,
    invalidate: [['orders'], ['cart']],
  });
}

export function useOrderReview(orderId: string | undefined) {
  const review = useMockDb((s) => s.reviews).find((r) => r.orderId === orderId);
  return useDualQuery({
    key: ['orders', 'review', orderId],
    live: async () => {
      const r = await customerOrdersApi.review(orderId!);
      return r ? { rating: r.rating, text: r.text ?? '' } : null;
    },
    mock: review ? { rating: review.rating, text: review.text } : null,
    enabled: Boolean(orderId),
  });
}

export function useSaveReview(orderId: string, storefrontId: string) {
  return useDualMutation<{ rating: number; text: string }, void>({
    live: async ({ rating, text }) => void (await customerOrdersApi.saveReview(orderId, rating, text)),
    mock: ({ rating, text }) => {
      const user = useAuthStore.getState().user;
      if (user) useMockDb.getState().addReview({ orderId, customerId: user.id, storefrontId, rating, text });
    },
    invalidate: [['orders'], ['community']],
  });
}

export function useComplain(orderId: string) {
  return useDualMutation<{ refund: boolean; description: string; refundAmount?: number }, void>({
    live: async ({ refund, description, refundAmount }) =>
      void (await customerOrdersApi.complain(orderId, {
        complaintType: refund ? 'REFUND_REQUEST' : 'COMPLAINT',
        description,
        requestedRefundAmount: refund ? (refundAmount ?? null) : null,
      })),
    mock: ({ refund, description }) => {
      const user = useAuthStore.getState().user;
      if (user) useMockDb.getState().addComplaint({ orderId, customerId: user.id, complaint_type: refund ? 'REFUND_REQUEST' : 'COMPLAINT', description });
    },
    invalidate: [['orders']],
  });
}

// ---- Seller ------------------------------------------------------------------

/** SORD-01: every order across the seller's storefronts; polls for new ones. */
export function useVendorOrders() {
  const userId = useAuthStore((s) => s.user?.id);
  const { storefront } = useMarketplaceGate();
  const mock = useMockOrderViews((o) => o.storefrontId === storefront?.id);
  return useDualQuery({
    key: ['vendor-orders', userId],
    live: async () => (await vendorOrdersApi.list()).items.map(fromApiOrder),
    mock,
    enabled: Boolean(userId),
    refetchInterval: 15_000,
  });
}

export function useVendorOrder(orderId: string | undefined) {
  const mock = useMockOrderViews((o) => o.id === orderId)[0] ?? null;
  return useDualQuery({
    key: ['vendor-orders', 'one', orderId],
    live: async () => fromApiOrder(await vendorOrdersApi.get(orderId!)),
    mock,
    enabled: Boolean(orderId),
    refetchInterval: 10_000,
  });
}

export type SellerAction = 'accept' | 'preparing' | 'ready' | 'reject' | 'handover';

/**
 * SORD-02/03: move an order along. Live: PLACED → ACCEPTED → PREPARING →
 * READY_FOR_PICKUP, and only the buyer's pickup code completes it. The demo
 * has no ACCEPTED step and lets the seller hand over directly.
 */
export function useSellerOrderAction() {
  return useDualMutation<{ orderId: string; action: SellerAction; reason?: string }, void>({
    live: async ({ orderId, action, reason }) => {
      if (action === 'accept') await vendorOrdersApi.accept(orderId);
      else if (action === 'preparing') await vendorOrdersApi.preparing(orderId);
      else if (action === 'ready') await vendorOrdersApi.ready(orderId);
      else if (action === 'reject') await vendorOrdersApi.reject(orderId, reason ?? 'Quán không thể nhận đơn');
    },
    mock: ({ orderId, action }) => {
      const next = { accept: 'PREPARING', preparing: 'PREPARING', ready: 'READY_FOR_PICKUP', reject: 'REJECTED', handover: 'COMPLETED' }[action];
      useMockDb.getState().updateOrderStatus(orderId, next);
    },
    invalidate: [['vendor-orders']],
  });
}

/** ORD-06: hand over by the buyer's QR token or the short code they read out. */
export function usePickupHandover() {
  const { storefront } = useMarketplaceGate();
  return useDualMutation<{ token?: string; code?: string }, OrderView>({
    live: async ({ token, code }) => fromApiOrder(token ? await vendorOrdersApi.scanPickup(token) : await vendorOrdersApi.confirmPickupCode(code ?? '')),
    mock: ({ token, code }) => {
      const value = (token ?? code ?? '').toLowerCase();
      const db = useMockDb.getState();
      const order = db.orders.find((o) => o.storefrontId === storefront?.id && o.order_code.toLowerCase() === value && o.order_status === 'READY_FOR_PICKUP');
      if (!order) throw new ApiError('not_found', 404, 'Mã chưa sẵn sàng hoặc thuộc quán khác.');
      db.updateOrderStatus(order.id, 'COMPLETED');
      const store = db.storefronts.find((s) => s.id === order.storefrontId);
      return fromMockOrder({ ...order, order_status: 'COMPLETED' }, store?.name ?? '');
    },
    invalidate: [['vendor-orders']],
  });
}

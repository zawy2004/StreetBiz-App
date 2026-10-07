import { apiDelete, apiGet, apiPost, apiPut, queryString } from './client';

/**
 * Marketplace, cart and orders: StreetBiz-BE `CommerceControllers.cs`
 * (/marketplace, /cart, /orders, /vendor/orders) and `OrderReviewsController`.
 * Same contracts as StreetBiz-FE's commerce-api.ts and orders/api/orderApi.ts.
 */

export type GeoPoint = { latitude: number; longitude: number };

export type MarketplaceMenuItem = {
  menuItemId: number;
  storefrontId: number;
  storefrontName: string;
  itemName: string;
  description: string | null;
  imageUrl: string | null;
  unitPrice: number;
  availabilityStatus: string;
  categoryId: number;
  categoryName: string;
  foodSafetyCertified?: boolean;
};

/** ISO weekday (1 = Monday … 7 = Sunday) with local "HH:mm" times. */
export type StorefrontHour = { dayOfWeek: number; opensAt: string; closesAt: string };

export type StorefrontSummary = {
  storefrontId: number;
  storefrontName: string;
  description: string | null;
  imageUrl: string | null;
  vendorId: number;
  address: string | null;
  wardId: number;
  wardName: string;
  zoneName: string;
  slotCode: string;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
  isOpenNow: boolean;
  todayHours: StorefrontHour[];
  communityRating: number | null;
  communityCount: number;
  menuItemCount: number;
  minPrice: number | null;
  categories: string[];
};

export type StorefrontDetail = {
  storefront: StorefrontSummary;
  weeklyHours: StorefrontHour[];
  menu: { categoryId: number; categoryName: string; items: MarketplaceMenuItem[] }[];
};

export type MarketplaceCategory = { categoryId: number; categoryName: string; itemCount: number };

export type CommerceCartItem = {
  cartItemId: number;
  menuItemId: number;
  itemName: string;
  imageUrl: string | null;
  unitPrice: number;
  availabilityStatus: string;
  quantity: number;
  note: string | null;
};

export type CommerceCart = {
  cartId: number;
  storefrontId: number;
  storefrontName: string;
  storefrontAddress: string | null;
  storefrontStatus: string;
  items: CommerceCartItem[];
  subtotal: number;
  /** Set while an order from this cart awaits payment; the cart is read-only until then. */
  pendingOrderId?: number | null;
};

export type ApiOrderItem = {
  orderItemId: number;
  menuItemId: number;
  itemName: string;
  unitPrice: number;
  quantity: number;
  note: string | null;
  lineTotal?: number;
};

export type ApiOrderHistory = { historyId: number; fromStatus: string | null; toStatus: string; note: string | null; changedAt: string };

export type ApiOrder = {
  orderId: number;
  orderCode: string;
  customerUserId: number;
  customerName: string;
  storefrontId: number;
  storefrontName: string;
  storefrontAddress?: string | null;
  orderStatus: string;
  subtotalAmount: number;
  totalAmount: number;
  rejectionReason: string | null;
  paymentProvider: string | null;
  paymentStatus: string | null;
  refundAmount: number | null;
  refundReason: string | null;
  refundStatus: string | null;
  placedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: ApiOrderItem[];
  history: ApiOrderHistory[];
};

export type PagedResult<T> = { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number };

export type PaymentProvider = 'MOMO' | 'ZALOPAY';

export type CheckoutResult = {
  orderId: number;
  orderCode: string;
  orderStatus: string;
  paymentTransactionId: number;
  provider: PaymentProvider;
  amount: number;
  paymentUrl: string;
};

export type PaymentOptions = {
  /** LIVE = MoMo's (test) gateway is configured; SANDBOX = simulated payment only. */
  mode: 'LIVE' | 'SANDBOX' | 'UNAVAILABLE';
  providers: PaymentProvider[];
  message: string;
};

/** ORD-06: the signed code the buyer shows at the stall (`token` for QR, `shortCode` to read out). */
export type PickupCode = { orderId: number; orderCode: string; orderStatus: string; storefrontName: string; token: string; shortCode: string };

export type OrderReview = { reviewId: number; rating: number; text: string | null } | null;

export type CustomerComplaint = {
  complaintId: number;
  orderId: number;
  complaintType: 'COMPLAINT' | 'REFUND_REQUEST';
  description: string;
  requestedRefundAmount: number | null;
  status: string;
  resolutionNotes: string | null;
  createdAt: string;
};

export type SalesBucket = { key: string; completedOrderCount: number; grossSales: number; refundedAmount: number; netSales: number };

export type SalesSummary = {
  fromDate: string;
  toDate: string;
  groupBy: 'day' | 'week' | 'month';
  completedOrderCount: number;
  grossSales: number;
  refundedAmount: number;
  netSales: number;
  buckets: SalesBucket[];
};

const position = (p?: GeoPoint) => ({ latitude: p?.latitude, longitude: p?.longitude });

export const marketplaceApi = {
  categories: () => apiGet<MarketplaceCategory[]>('/marketplace/categories'),
  storefronts: (filters: { query?: string; categoryId?: number; openNow?: boolean; sort?: 'distance' | 'rating' | 'name'; position?: GeoPoint; take?: number } = {}) => {
    const { position: at, ...rest } = filters;
    return apiGet<StorefrontSummary[]>(`/marketplace/storefronts${queryString({ ...rest, ...position(at) })}`);
  },
  storefront: (storefrontId: string | number) => apiGet<StorefrontDetail>(`/marketplace/storefronts/${storefrontId}`),
  menuItems: (query: string, take = 30) => apiGet<MarketplaceMenuItem[]>(`/marketplace/menu-items${queryString({ query, take })}`),
  menuItem: (menuItemId: string | number) => apiGet<MarketplaceMenuItem>(`/marketplace/menu-items/${menuItemId}`),
};

export const cartApi = {
  get: () => apiGet<CommerceCart | null>('/cart'),
  add: (menuItemId: number, quantity: number, note?: string) =>
    apiPost<CommerceCart>('/cart/items', { menuItemId, quantity, note: note || null }),
  update: (menuItemId: number, quantity: number, note?: string | null) =>
    apiPut<CommerceCart>(`/cart/items/${menuItemId}`, { quantity, note: note || null }),
  remove: (menuItemId: number) => apiDelete<CommerceCart | null>(`/cart/items/${menuItemId}`),
  clear: () => apiDelete<void>('/cart'),
};

export const customerOrdersApi = {
  paymentOptions: () => apiGet<PaymentOptions>('/orders/payment-options'),
  checkout: (cartId: number, provider: PaymentProvider, idempotencyKey: string) =>
    apiPost<CheckoutResult>('/orders/checkout', { cartId, provider }, { headers: { 'Idempotency-Key': idempotencyKey } }),
  list: () => apiGet<PagedResult<ApiOrder>>('/orders/me?page=1&pageSize=50&sort=createdAt_desc'),
  get: (orderId: string | number) => apiGet<ApiOrder>(`/orders/${orderId}`),
  cancel: (orderId: string | number) => apiPost<ApiOrder>(`/orders/${orderId}/cancel`),
  pickupCode: (orderId: string | number) => apiGet<PickupCode>(`/orders/${orderId}/pickup-code`),
  /** Back from the payment page: the backend asks the provider for the real state. */
  syncPayment: (orderId: string | number) => apiPost<ApiOrder>(`/orders/${orderId}/payment/sync`),
  /** Development sandbox only (404 elsewhere). */
  sandboxConfirm: (orderId: string | number) => apiPost<ApiOrder>(`/orders/${orderId}/payment/sandbox-confirm`),
  sandboxFail: (orderId: string | number) => apiPost<ApiOrder>(`/orders/${orderId}/payment/sandbox-fail`),
  review: (orderId: string | number) => apiGet<OrderReview>(`/orders/${orderId}/review`),
  saveReview: (orderId: string | number, rating: number, text: string) => apiPut<{ reviewId: number }>(`/orders/${orderId}/review`, { rating, text }),
  complaints: (orderId: string | number) => apiGet<CustomerComplaint[]>(`/orders/${orderId}/complaints`),
  complain: (orderId: string | number, input: { complaintType: 'COMPLAINT' | 'REFUND_REQUEST'; description: string; requestedRefundAmount: number | null }) =>
    apiPost<CustomerComplaint>(`/orders/${orderId}/complaints`, input),
};

export const vendorOrdersApi = {
  list: (status?: string) => apiGet<PagedResult<ApiOrder>>(`/vendor/orders${queryString({ status, page: 1, pageSize: 100, sort: 'createdAt_desc' })}`),
  get: (orderId: string | number) => apiGet<ApiOrder>(`/vendor/orders/${orderId}`),
  accept: (orderId: string | number) => apiPost<ApiOrder>(`/vendor/orders/${orderId}/accept`),
  reject: (orderId: string | number, reason: string) => apiPost<ApiOrder>(`/vendor/orders/${orderId}/reject`, { reason }),
  preparing: (orderId: string | number) => apiPost<ApiOrder>(`/vendor/orders/${orderId}/preparing`),
  ready: (orderId: string | number) => apiPost<ApiOrder>(`/vendor/orders/${orderId}/ready-for-pickup`),
  /** ORD-06: the scanned code identifies the order, so no order id is sent. */
  scanPickup: (token: string) => apiPost<ApiOrder>('/vendor/orders/pickup-scan', { token }),
  confirmPickupCode: (code: string) => apiPost<ApiOrder>('/vendor/orders/pickup-confirm', { code }),
  salesSummary: (fromDate: string, toDate: string, groupBy: 'day' | 'week' | 'month') =>
    apiGet<SalesSummary>(`/vendor/orders/sales-summary${queryString({ fromDate, toDate, groupBy })}`),
};

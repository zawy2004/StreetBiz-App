import { apiDelete, apiGet, apiPost, apiPut } from './client';

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
  /** Covered by an approved, in-date ATTP certificate. */
  foodSafetyCertified?: boolean;
};

export type GeoPoint = { latitude: number; longitude: number };

/** ISO weekday (1 = Monday ... 7 = Sunday) with local "HH:mm" times. */
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

export type StorefrontMenuCategory = {
  categoryId: number;
  categoryName: string;
  items: MarketplaceMenuItem[];
};

export type StorefrontDetail = {
  storefront: StorefrontSummary;
  weeklyHours: StorefrontHour[];
  menu: StorefrontMenuCategory[];
};

/** A ward with at least one listed storefront; `distanceMeters` is to its nearest one. */
export type ServiceArea = {
  wardId: number;
  wardName: string;
  districtName: string | null;
  storefrontCount: number;
  distanceMeters: number | null;
};

export type MarketplaceCategory = { categoryId: number; categoryName: string; itemCount: number };

export type StorefrontSort = 'distance' | 'rating' | 'name';
export type MenuItemSort = 'name' | 'price_asc' | 'price_desc';

export type StorefrontQuery = {
  query?: string;
  wardId?: number;
  categoryId?: number;
  openNow?: boolean;
  position?: GeoPoint;
  radiusMeters?: number;
  sort?: StorefrontSort;
  take?: number;
};

export type MenuItemQuery = {
  query?: string;
  wardId?: number;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  openNow?: boolean;
  sort?: MenuItemSort;
  take?: number;
};

/** Builds "?a=1&b=x" from the params that are set, encoding with %20 like the rest of the client. */
function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

const positionParams = (position?: GeoPoint) => ({
  latitude: position?.latitude,
  longitude: position?.longitude,
});

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
  /** Set while an order from this cart awaits payment; the cart is read-only until it is paid or cancelled. */
  pendingOrderId?: number | null;
};

export type CommerceOrderItem = {
  orderItemId: number;
  menuItemId: number;
  itemName: string;
  unitPrice: number;
  quantity: number;
  note: string | null;
};

export type CommerceOrderHistory = {
  historyId: number;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  changedAt: string;
};

export type CommerceOrder = {
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
  refundRequestedAt: string | null;
  refundCompletedAt: string | null;
  placedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: CommerceOrderItem[];
  history: CommerceOrderHistory[];
};

export type SalesSummary = {
  period: 'DAY' | 'WEEK' | 'MONTH';
  fromUtc: string;
  toUtc: string;
  completedOrderCount: number;
  grossSales: number;
  refundedAmount: number;
  netSales: number;
  orders: CommerceOrder[];
};

export type PaymentOptions = {
  /** LIVE = MoMo's own (test) gateway is configured; SANDBOX = in-app simulated payment. */
  mode: 'LIVE' | 'SANDBOX' | 'UNAVAILABLE';
  providers: ('MOMO' | 'ZALOPAY')[];
  message: string;
};
export type CustomerComplaint = {
  complaintId: number;
  orderId: number;
  complaintType: string;
  description: string;
  requestedRefundAmount: number | null;
  status: string;
  resolutionNotes: string | null;
  createdAt: string;
};

export const commerceApi = {
  review: (orderId: string | number) =>
    apiGet<{ reviewId: number; rating: number; text: string | null } | null>(
      `/orders/${orderId}/review`,
    ),
  saveReview: (orderId: number, rating: number, text: string) =>
    apiPut<{ reviewId: number }>(`/orders/${orderId}/review`, { rating, text }),
  paymentOptions: () => apiGet<PaymentOptions>('/orders/payment-options'),
  failSandboxPayment: (orderId: number) =>
    apiPost<CommerceOrder>(`/orders/${orderId}/payment/sandbox-fail`),
  confirmSandboxRefund: (orderId: number) =>
    apiPost<CommerceOrder>(`/orders/${orderId}/refund/sandbox-confirm`),
  complaints: (orderId: string | number) =>
    apiGet<CustomerComplaint[]>(`/orders/${orderId}/complaints`),
  complain: (
    orderId: number,
    input: { complaintType: string; description: string; requestedRefundAmount: number | null },
  ) => apiPost<CustomerComplaint>(`/orders/${orderId}/complaints`, input),
  menuItems: (query?: string | MenuItemQuery) => {
    const filters = typeof query === 'string' ? { query } : (query ?? {});
    return apiGet<MarketplaceMenuItem[]>(`/marketplace/menu-items${queryString({ ...filters })}`);
  },
  menuItem: (menuItemId: string | number) =>
    apiGet<MarketplaceMenuItem>(`/marketplace/menu-items/${menuItemId}`),

  serviceAreas: (position?: GeoPoint) =>
    apiGet<ServiceArea[]>(`/marketplace/service-areas${queryString(positionParams(position))}`),
  marketplaceCategories: () => apiGet<MarketplaceCategory[]>('/marketplace/categories'),
  storefronts: ({ position, ...filters }: StorefrontQuery = {}) =>
    apiGet<StorefrontSummary[]>(
      `/marketplace/storefronts${queryString({ ...filters, ...positionParams(position) })}`,
    ),
  storefront: (storefrontId: string | number, position?: GeoPoint) =>
    apiGet<StorefrontDetail>(
      `/marketplace/storefronts/${storefrontId}${queryString(positionParams(position))}`,
    ),

  cart: () => apiGet<CommerceCart | null>('/cart'),
  addCartItem: (menuItemId: number, quantity: number, note?: string) =>
    apiPost<CommerceCart>('/cart/items', { menuItemId, quantity, note: note || null }),
  updateCartItem: (menuItemId: number, quantity: number, note?: string | null) =>
    apiPut<CommerceCart>(`/cart/items/${menuItemId}`, { quantity, note: note || null }),
  removeCartItem: (menuItemId: number) =>
    apiDelete<CommerceCart | null>(`/cart/items/${menuItemId}`),
  clearCart: () => apiDelete<void>('/cart'),

  placeOrder: (provider: 'MOMO' | 'ZALOPAY', idempotencyKey: string) =>
    apiPost<CommerceOrder>('/orders', { provider, idempotencyKey }),
  confirmSandboxPayment: (orderId: number) =>
    apiPost<CommerceOrder>(`/orders/${orderId}/payment/sandbox-confirm`),
  customerOrders: () => apiGet<CommerceOrder[]>('/orders'),
  customerOrder: (orderId: string | number) => apiGet<CommerceOrder>(`/orders/${orderId}`),
  cancelOrder: (orderId: number, expectedStatus: string) =>
    apiPost<CommerceOrder>(`/orders/${orderId}/cancel`, { expectedStatus }),

  sellerOrders: (status?: string) =>
    apiGet<CommerceOrder[]>(
      `/seller/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),
  sellerOrder: (orderId: string | number) => apiGet<CommerceOrder>(`/seller/orders/${orderId}`),
  decideSellerOrder: (
    orderId: number,
    decision: 'ACCEPT' | 'REJECT',
    reason: string | null,
    expectedStatus: string,
  ) =>
    apiPost<CommerceOrder>(`/seller/orders/${orderId}/decision`, {
      decision,
      reason,
      expectedStatus,
    }),
  updateSellerOrderStatus: (
    orderId: number,
    targetStatus: 'PREPARING' | 'READY_FOR_PICKUP',
    expectedStatus: string,
  ) =>
    apiPost<CommerceOrder>(`/seller/orders/${orderId}/status`, {
      targetStatus,
      expectedStatus,
    }),
  salesSummary: (period: 'DAY' | 'WEEK' | 'MONTH') =>
    apiGet<SalesSummary>(`/seller/orders/sales-summary?period=${period}`),
};

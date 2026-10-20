export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PLACED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentProvider = 'MOMO' | 'ZALOPAY';
export type RefundStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface OrderItem {
  orderItemId: number;
  menuItemId: number;
  itemName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  note?: string | null;
}

export interface OrderStatusHistory {
  historyId?: number;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  changedAt: string;
  note?: string | null;
}

export interface OrderStorefront {
  storefrontId: number;
  storefrontName: string;
  imageUrl?: string | null;
  address?: string | null;
}

export interface Order {
  orderId: number;
  orderCode: string;
  customerUserId?: number;
  customerName?: string;
  orderStatus: OrderStatus;
  storefront: OrderStorefront;
  items: OrderItem[];
  subtotalAmount: number;
  totalAmount: number;
  rejectionReason?: string | null;
  paymentProvider?: PaymentProvider | null;
  paymentStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | null;
  refundAmount?: number | null;
  refundReason?: string | null;
  refundStatus?: RefundStatus | null;
  refundRequestedAt?: string | null;
  refundCompletedAt?: string | null;
  placedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  statusHistory: OrderStatusHistory[];
}

/** Where the customer is when ordering, as the browser reported it (ORD-01 pickup range). */
export interface PickupLocation {
  latitude: number;
  longitude: number;
  /** The Geolocation API's own figure: 95% of the time the true position is within this radius. */
  accuracyMeters: number;
}

export interface CheckoutRequest {
  cartId: number;
  provider: PaymentProvider;
  location?: PickupLocation;
}

/** The stall's rented slot: where a pickup order is collected. */
export interface PickupPoint {
  storefrontId: number;
  storefrontName: string;
  address: string | null;
  latitude: number;
  longitude: number;
}

/** GET /marketplace/storefronts/{id}/pickup-range: the point plus the rule the server applies. */
export interface PickupRangeInfo {
  pickupPoint: PickupPoint;
  enforced: boolean;
  radiusMeters: number;
  accuracyAllowanceMeters: number;
  maxAccuracyMeters: number;
}

/**
 * When an order should be ready. Minutes are the stall's usual range (its middle half of recent
 * orders, or a default with too little history); the instants exist once the stall has accepted.
 */
export interface ReadyEstimate {
  lowMinutes: number;
  typicalMinutes: number;
  highMinutes: number;
  basis: 'HISTORY' | 'DEFAULT';
  sampleSize: number;
  earliestReadyAt: string | null;
  latestReadyAt: string | null;
  isLate: boolean;
}

/** GET /orders/{id}/tracking: the forward-looking half of tracking (history stays on Order). */
export interface OrderTracking {
  orderId: number;
  orderStatus: OrderStatus;
  pickupPoint: PickupPoint;
  readyEstimate: ReadyEstimate | null;
  ordersAhead: number;
  readyAt: string | null;
  /** When the customer last told the stall they were on the way. */
  arrivalNotifiedAt?: string | null;
  /** Notices sent so far (at most 3 per order). */
  arrivalNoticeCount?: number;
  /** When the stall answered "Đã thấy" to the latest notice. */
  arrivalAcknowledgedAt?: string | null;
}

/** POST /orders/{id}/arriving: the stall has been told; `alreadySent` when within the 2-minute window. */
export interface ArrivalNotice {
  orderId: number;
  orderStatus: OrderStatus;
  notifiedAt: string;
  alreadySent: boolean;
}

/** GET /vendor/orders/arrivals: a customer on the way, for the seller's board. */
export interface OrderArrival {
  orderId: number;
  orderCode: string;
  notifiedAt: string;
  message: string;
  /** When the stall answered "Đã thấy" to this notice, if it has. */
  acknowledgedAt?: string | null;
}

/** POST /vendor/orders/{id}/arrival-seen. */
export interface ArrivalAck {
  orderId: number;
  orderStatus: OrderStatus;
  acknowledgedAt: string;
  alreadyAcknowledged: boolean;
}

export interface CheckoutResponse {
  orderId: number;
  orderCode: string;
  orderStatus: 'PENDING_PAYMENT';
  paymentTransactionId: number;
  provider: PaymentProvider;
  amount: number;
  paymentUrl: string;
}

export interface OrderListFilters {
  /** Several statuses serve a tab that groups them, e.g. rejected and cancelled. */
  status?: OrderStatus | readonly OrderStatus[];
  page?: number;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
  sort?: 'createdAt_asc' | 'createdAt_desc' | 'orderCode_asc' | 'orderCode_desc';
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type SalesGroup = 'day' | 'week' | 'month';

export interface SalesBucket {
  key: string;
  completedOrderCount: number;
  grossSales: number;
  refundedAmount: number;
  netSales: number;
}

export interface SalesSummary {
  fromDate: string;
  toDate: string;
  groupBy: SalesGroup;
  completedOrderCount: number;
  grossSales: number;
  refundedAmount: number;
  netSales: number;
  buckets: SalesBucket[];
}

export const TERMINAL_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
]);

/**
 * ORD-06: the code a paid buyer shows at the stall. The seller scans it to prove
 * this buyer holds this order before handing it over.
 */
export type OrderPickupCode = {
  orderId: number;
  orderCode: string;
  orderStatus: OrderStatus;
  storefrontName: string;
  token: string;
  /** The same proof, short enough for the seller to type when a camera fails. */
  shortCode: string;
};

/** Paid and still waiting to change hands, so a pickup code is worth showing. */
export const COLLECTABLE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
]);

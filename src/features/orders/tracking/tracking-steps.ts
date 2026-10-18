import type { OrderStatus, OrderStatusHistory } from '../types/order.types';

/**
 * ORD-02: an order's journey as the customer cares about it. The timeline lists what happened;
 * this also shows what is still to come, which is the question a hungry customer actually has
 * ("is it done yet?"). Pure functions, so the live and the demo screens draw the same thing.
 */
export type TrackingStepState = 'done' | 'current' | 'upcoming' | 'stopped';

export type TrackingStep = {
  status: OrderStatus;
  label: string;
  icon: string;
  state: TrackingStepState;
  /** When the order reached this step; null if it has not, or skipped it on the way. */
  reachedAt: string | null;
};

// Short, even-length labels in the status chips' own words: five columns share a 360 px phone.
const FLOW: ReadonlyArray<{ status: OrderStatus; label: string; icon: string }> = [
  { status: 'PLACED', label: 'Đã đặt', icon: 'receipt' },
  { status: 'ACCEPTED', label: 'Xác nhận', icon: 'storefront-outline' },
  { status: 'PREPARING', label: 'Đang làm', icon: 'silverware-fork-knife' },
  { status: 'READY_FOR_PICKUP', label: 'Sẵn sàng', icon: 'bell-ring' },
  { status: 'COMPLETED', label: 'Hoàn tất', icon: 'check-circle-outline' },
];

const STOPPED: Partial<Record<OrderStatus, { label: string; icon: string }>> = {
  CANCELLED: { label: 'Đã huỷ', icon: 'close-circle-outline' },
  REJECTED: { label: 'Bị từ chối', icon: 'close-circle-outline' },
};

/** The demo database names two statuses differently; everything else matches. */
export function normalizeTrackingStatus(status: string): OrderStatus {
  if (status === 'PENDING') return 'PLACED';
  if (status === 'PICKED_UP') return 'COMPLETED';
  return status as OrderStatus;
}

/** Before payment is confirmed there is no journey yet, only a payment to finish. */
export const hasTrackingJourney = (status: OrderStatus) => status !== 'PENDING_PAYMENT';

function firstReached(history: readonly OrderStatusHistory[], status: OrderStatus): string | null {
  return history.find((entry) => entry.toStatus === status)?.changedAt ?? null;
}

export function buildTrackingSteps(
  status: OrderStatus,
  history: readonly OrderStatusHistory[],
): TrackingStep[] {
  const stopped = STOPPED[status];
  if (stopped) {
    // Keep the steps the order got through, then the point where it stopped. Steps it will
    // never reach are left out: greyed "upcoming" steps would promise a future that is gone.
    const reached = FLOW.filter((step) => firstReached(history, step.status));
    return [
      ...reached.map((step) => ({
        ...step,
        state: 'done' as const,
        reachedAt: firstReached(history, step.status),
      })),
      {
        status,
        ...stopped,
        state: 'stopped' as const,
        reachedAt: firstReached(history, status),
      },
    ];
  }

  const currentIndex = FLOW.findIndex((step) => step.status === status);
  return FLOW.map((step, index) => ({
    ...step,
    state:
      index < currentIndex || (status === 'COMPLETED' && index === currentIndex)
        ? ('done' as const)
        : index === currentIndex
          ? ('current' as const)
          : ('upcoming' as const),
    reachedAt: index <= currentIndex ? firstReached(history, step.status) : null,
  }));
}

/** 0..1 along the flow, for the progress line under the steps. */
export function trackingProgress(steps: readonly TrackingStep[]): number {
  if (steps.length < 2) return 0;
  const last = steps.reduce(
    (found, step, index) => (step.state === 'done' || step.state === 'current' ? index : found),
    0,
  );
  return last / (steps.length - 1);
}

/** One sentence that answers "what is happening with my order?". */
export const TRACKING_HEADLINES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Đang chờ xác nhận thanh toán',
  PLACED: 'Đang chờ quán nhận đơn',
  ACCEPTED: 'Quán đã nhận đơn và sắp bắt đầu làm',
  PREPARING: 'Quán đang chuẩn bị món của bạn',
  READY_FOR_PICKUP: 'Món đã sẵn sàng, mời bạn đến quầy lấy',
  COMPLETED: 'Bạn đã nhận món. Chúc ngon miệng!',
  CANCELLED: 'Đơn hàng đã được huỷ',
  REJECTED: 'Quán đã từ chối đơn hàng',
};

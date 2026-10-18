import type { SidewalkSlot } from '@/core/api/side-api';
import { uuid } from '@/core/utils/uuid';
import { vendorActionsFor } from '@/features/orders/components/vendor-actions';
import { isSandboxPaymentUrl } from '@/features/orders/payment-redirect';
import { applicationProgress } from '@/features/sidewalk-slots/application-progress';
import { transferSteps } from '@/features/sidewalk-slots/my-slots-view';
import { slotDisplayState } from '@/features/sidewalk-slots/slot-stats';

describe('order workflow (ORD-03..06)', () => {
  it('offers the vendor exactly the next step of each stage, and nothing once an order ended', () => {
    expect(vendorActionsFor('PLACED')).toEqual(['accept', 'reject']);
    expect(vendorActionsFor('ACCEPTED')).toEqual(['preparing']);
    expect(vendorActionsFor('PREPARING')).toEqual(['ready']);
    expect(vendorActionsFor('READY_FOR_PICKUP')).toEqual(['handover']);
    for (const ended of ['COMPLETED', 'REJECTED', 'CANCELLED', 'PENDING_PAYMENT'] as const) {
      expect(vendorActionsFor(ended)).toEqual([]);
    }
  });
});

describe('payment flow (BR-32, BR-37)', () => {
  it('makes a fresh v4 idempotency key per attempt', () => {
    const a = uuid();
    const b = uuid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });

  it('tells the development sandbox link from a real wallet page', () => {
    expect(isSandboxPaymentUrl('streetbiz://payment/sandbox/abc')).toBe(true);
    expect(isSandboxPaymentUrl('https://test-payment.momo.vn/pay?x=1')).toBe(false);
  });
});

describe('rental workflow (SIDE-03..13)', () => {
  const states = (status: string, reviewedAt: string | null = null) =>
    applicationProgress(status, '2026-10-01', reviewedAt)?.map((s) => s.state);

  it('walks an application through its three stops', () => {
    expect(states('PENDING')).toEqual(['done', 'waiting', 'todo']);
    expect(states('MORE_INFORMATION_REQUIRED', '2026-10-02')).toEqual(['done', 'attention', 'todo']);
    expect(states('APPROVED', '2026-10-03')).toEqual(['done', 'done', 'approved']);
    expect(states('REJECTED', '2026-10-03')).toEqual(['done', 'done', 'rejected']);
    expect(states('WITHDRAWN')).toEqual(['done', 'skipped', 'withdrawn']);
  });

  it('shows a transfer waiting on the receiver, then the ward, then done; a rejected one has no progress', () => {
    expect(transferSteps('PENDING')).toEqual(['done', 'current', 'todo']);
    expect(transferSteps('ACCEPTED_BY_RECEIVER')).toEqual(['done', 'done', 'current']);
    expect(transferSteps('APPROVED')).toEqual(['done', 'done', 'done']);
    expect(transferSteps('REJECTED')).toBeNull();
  });

  it('reads a free slot with a live hold as held, and as free again once the hold lapses', () => {
    const now = Date.parse('2026-10-18T03:00:00Z');
    const slot = { slotStatus: 'AVAILABLE', holdExpiresAt: '2026-10-18T03:10:00Z' } as SidewalkSlot;
    expect(slotDisplayState(slot, now)).toBe('HELD');
    expect(slotDisplayState(slot, Date.parse('2026-10-18T03:11:00Z'))).toBe('AVAILABLE');
    expect(slotDisplayState({ ...slot, slotStatus: 'PENDING_APPLICATION' }, now)).toBe('PENDING');
    expect(slotDisplayState({ ...slot, slotStatus: 'RENTED' }, now)).toBe('ACTIVE');
  });
});

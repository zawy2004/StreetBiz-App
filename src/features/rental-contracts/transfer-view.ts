import type { SlotTransferRequest } from '@/core/api/side-api';

/** Display-only counts of the requests a vendor has sent, by where each one stands. */
export type OutgoingStageCounts = {
  waitingReceiver: number;
  waitingWard: number;
  approved: number;
  rejected: number;
};

export function countOutgoingByStage(
  transfers: readonly Pick<SlotTransferRequest, 'transferStatus'>[],
): OutgoingStageCounts {
  const counts: OutgoingStageCounts = {
    waitingReceiver: 0,
    waitingWard: 0,
    approved: 0,
    rejected: 0,
  };
  for (const t of transfers) {
    if (t.transferStatus === 'PENDING') counts.waitingReceiver += 1;
    else if (t.transferStatus === 'ACCEPTED_BY_RECEIVER') counts.waitingWard += 1;
    else if (t.transferStatus === 'APPROVED') counts.approved += 1;
    else if (t.transferStatus === 'REJECTED') counts.rejected += 1;
  }
  return counts;
}

/** Whole local days from `iso` to `today` (0 for today), never negative. */
export function daysSince(iso: string, today: Date): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 0;
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

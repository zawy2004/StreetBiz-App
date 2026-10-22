import type { SidewalkSlot } from '@/core/api/side-api';
import type { SlotCounts } from './slot-stats';

/** Display-only wording and maths shared by the slot plan's pieces. Pure. */

/** Under two minutes left the ring turns deep orange. */
export const HOLD_WARNING_SECONDS = 120;

/** Share of the hold still left, 0..1, from its own start and end (never a fixed 15 minutes). */
export function holdFraction(heldAt: string, expiresAt: string, nowMs: number): number {
  const start = Date.parse(heldAt);
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(1, Math.max(0, (end - nowMs) / (end - start)));
}

export const metres = (value: number) =>
  `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m`;

export function bayLabel(
  slot: Pick<
    SidewalkSlot,
    'slotCode' | 'widthMeters' | 'lengthMeters' | 'hasPower' | 'hasWater' | 'hasTrashBin'
  >,
): string {
  const measured = slot.widthMeters != null && slot.lengthMeters != null;
  const size = measured
    ? `mặt tiền ${metres(slot.widthMeters!)}, sâu ${metres(slot.lengthMeters!)}, ${(slot.widthMeters! * slot.lengthMeters!).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m²`
    : 'chưa đo kích thước';
  const amenities = [
    slot.hasPower ? 'có điện' : 'không có điện',
    slot.hasWater ? 'có nước' : 'không có nước',
    slot.hasTrashBin ? 'có thùng rác' : 'không có thùng rác',
  ].join(', ');
  return `Ô ${slot.slotCode}, ${size}, ${amenities}`;
}

/** How full the route is, in one bar (holds count with applications, as the plan shows them). */
export function occupancyLabel(counts: SlotCounts): string {
  return `${counts.total} ô: ${counts.available} còn trống, ${counts.pending} có đơn hoặc giữ chỗ, ${counts.active} đã thuê, ${counts.suspended} tạm ngưng`;
}

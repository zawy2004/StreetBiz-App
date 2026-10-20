import type { BusinessCategory, SidewalkSlot } from '@/core/api/side-api';

/**
 * Pure counting/filtering for the slot workspace. Nothing here reads the clock:
 * callers pass `nowMs`, so a hold that lapses between renders is decided by the
 * caller's own tick (and tests stay deterministic).
 */

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  FOOD_BEVERAGE: 'Ẩm thực & Đồ uống',
  RETAIL: 'Bán lẻ',
  SERVICES: 'Dịch vụ',
  CRAFTS: 'Thủ công & Lưu niệm',
  GENERAL: 'Đa ngành',
};

/**
 * What a slot looks like on the plan. HELD is an AVAILABLE slot with a live
 * hold; it renders like a pending application because neither can be applied
 * for by someone else right now.
 */
export type SlotDisplayState = 'AVAILABLE' | 'HELD' | 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export function slotDisplayState(slot: SidewalkSlot, nowMs: number): SlotDisplayState {
  switch (slot.slotStatus) {
    case 'AVAILABLE':
      return isHeld(slot, nowMs) ? 'HELD' : 'AVAILABLE';
    case 'PENDING_APPLICATION':
      return 'PENDING';
    case 'SUSPENDED':
      return 'SUSPENDED';
    default:
      return 'ACTIVE';
  }
}

export function isHeld(slot: Pick<SidewalkSlot, 'holdExpiresAt'>, nowMs: number): boolean {
  return slot.holdExpiresAt != null && Date.parse(slot.holdExpiresAt) > nowMs;
}

export type SlotCounts = {
  total: number;
  available: number;
  /** Pending applications plus live holds. */
  pending: number;
  /** Rented out. */
  active: number;
  suspended: number;
};

export function countSlots(slots: readonly SidewalkSlot[], nowMs: number): SlotCounts {
  const counts: SlotCounts = { total: slots.length, available: 0, pending: 0, active: 0, suspended: 0 };
  for (const slot of slots) {
    switch (slotDisplayState(slot, nowMs)) {
      case 'AVAILABLE':
        counts.available += 1;
        break;
      case 'HELD':
      case 'PENDING':
        counts.pending += 1;
        break;
      case 'SUSPENDED':
        counts.suspended += 1;
        break;
      case 'ACTIVE':
        counts.active += 1;
        break;
    }
  }
  return counts;
}

// A shift is a window of the day; a slot belongs to every shift its opening
// hours overlap. The ward's opening hours are per zone (05:00-22:00 covers both),
// so "shift" is a filter on when a vendor may trade, not a separate field.
export type Shift = 'MORNING' | 'AFTERNOON_EVENING';

const SHIFT_WINDOWS: Record<Shift, readonly [number, number]> = {
  MORNING: [0, 12 * 60],
  AFTERNOON_EVENING: [12 * 60, 24 * 60],
};

export const SHIFT_LABELS: Record<Shift, string> = {
  MORNING: 'Ca sáng',
  AFTERNOON_EVENING: 'Ca chiều - tối',
};

function minutesOfDay(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return Number(h) * 60 + Number(m);
}

/** A missing window means the whole day, so it overlaps every shift. */
export function overlapsShift(slot: Pick<SidewalkSlot, 'availableFrom' | 'availableTo'>, shift: Shift): boolean {
  if (!slot.availableFrom || !slot.availableTo) return true;
  const from = minutesOfDay(slot.availableFrom);
  const to = minutesOfDay(slot.availableTo);
  const [shiftFrom, shiftTo] = SHIFT_WINDOWS[shift];
  return from < shiftTo && to > shiftFrom;
}

export type SlotFilters = {
  /** 'ALL' or one display state. */
  state: SlotDisplayState | 'ALL';
  category: BusinessCategory | 'ALL';
  shift: Shift | 'ALL';
  power: boolean;
  water: boolean;
};

export const NO_FILTERS: SlotFilters = { state: 'ALL', category: 'ALL', shift: 'ALL', power: false, water: false };

export function hasActiveFilters(filters: SlotFilters): boolean {
  return (
    filters.state !== 'ALL' ||
    filters.category !== 'ALL' ||
    filters.shift !== 'ALL' ||
    filters.power ||
    filters.water
  );
}

export function slotMatchesFilters(slot: SidewalkSlot, filters: SlotFilters, nowMs: number): boolean {
  if (filters.state !== 'ALL' && slotDisplayState(slot, nowMs) !== filters.state) return false;
  if (filters.category !== 'ALL' && slot.businessCategory !== filters.category) return false;
  if (filters.shift !== 'ALL' && !overlapsShift(slot, filters.shift)) return false;
  if (filters.power && !slot.hasPower) return false;
  if (filters.water && !slot.hasWater) return false;
  return true;
}

/** Case-insensitive match on slot code or zone name; an empty query matches everything. */
export function slotMatchesSearch(slot: Pick<SidewalkSlot, 'slotCode' | 'zoneName'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return slot.slotCode.toLowerCase().includes(q) || slot.zoneName.toLowerCase().includes(q);
}

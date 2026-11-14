import type { RentalChoice, SellerStore } from '@/core/api/seller-store-api';

/**
 * Display helpers for the vendor's stalls, over data the screen already has.
 * They never decide who may open a stall: the eligibility rule stays in the
 * screen, these only explain it.
 */

/** The active contract a stall stands on; undefined when it is no longer among the loaded ones. */
export function contractFor(store: Pick<SellerStore, 'contractId'>, contracts: RentalChoice[]) {
  return contracts.find((contract) => contract.contractId === store.contractId);
}

/** "dd/mm/yyyy" for a "yyyy-mm-dd" date; anything else is shown as written. */
export function displayDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d && value.length >= 10 ? `${d}/${m}/${y}` : value;
}

/**
 * Why no new stall can be opened yet, in the vendor's words, from the contracts
 * already loaded and the same "today" the screen uses. Null when the generic
 * message is all that can honestly be said.
 */
export function eligibilityReason(contracts: RentalChoice[], today: string): string | null {
  const active = contracts.filter((contract) => contract.contractStatus === 'ACTIVE');
  if (active.length === 0) return 'Chưa có hợp đồng thuê ô đang hiệu lực';
  const upcoming = active
    .filter((contract) => contract.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (upcoming)
    return `Hợp đồng ô ${upcoming.slotCode} có hiệu lực từ ${displayDate(upcoming.startDate)}`;
  return null;
}

/** What each status means for buyers, said plainly (only the paused case is verified end to end). */
export const STATUS_CONSEQUENCE: Record<string, string> = {
  OPEN: 'Đang mở: gian hàng nhận khách như thường lệ.',
  PAUSED: 'Tạm dừng: khách tạm thời không xem được món của quán.',
  CLOSED: 'Đóng cửa: dùng khi quán nghỉ dài ngày.',
};

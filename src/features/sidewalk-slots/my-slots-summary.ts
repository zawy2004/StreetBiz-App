import type { RentalApplication, RentalContract, SlotTransferRequest } from '@/core/api/side-api';

/** One line per section of the "Thuê ô của tôi" page; `attention` marks something waiting on the vendor. */
export type SectionSummary = { text: string; attention: boolean };

export type MySlotsSummary = {
  applications: SectionSummary;
  contracts: SectionSummary;
  transfers: SectionSummary;
};

// Applications the ward has not decided yet (same set the backend calls "open").
const OPEN_APPLICATION_STATUSES = ['PENDING', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED'];

/**
 * The lists are optional because each is fetched separately and may still be
 * loading or have failed; a missing list yields a neutral line, never a wrong count.
 */
export function summarizeMySlots(input: {
  applications?: readonly RentalApplication[];
  contracts?: readonly RentalContract[];
  incomingTransfers?: readonly SlotTransferRequest[];
}): MySlotsSummary {
  const { applications, contracts, incomingTransfers } = input;

  let applicationSummary: SectionSummary = { text: 'Theo dõi đơn đã nộp', attention: false };
  if (applications) {
    const needInfo = applications.filter((a) => a.applicationStatus === 'MORE_INFORMATION_REQUIRED').length;
    const open = applications.filter((a) => OPEN_APPLICATION_STATUSES.includes(a.applicationStatus)).length;
    applicationSummary =
      needInfo > 0
        ? { text: `${needInfo} đơn cần bổ sung`, attention: true }
        : open > 0
          ? { text: `${open} đơn đang chờ duyệt`, attention: false }
          : { text: 'Chưa có đơn nào đang chờ', attention: false };
  }

  let contractSummary: SectionSummary = { text: 'Xem hợp đồng, gia hạn, trả ô', attention: false };
  if (contracts) {
    const active = contracts.filter((c) => c.contractStatus === 'ACTIVE').length;
    contractSummary = { text: active > 0 ? `${active} hợp đồng đang hiệu lực` : 'Chưa có hợp đồng hiệu lực', attention: false };
  }

  let transferSummary: SectionSummary = { text: 'Chuyển ô cho hộ khác hoặc nhận ô', attention: false };
  if (incomingTransfers) {
    const waiting = incomingTransfers.filter((t) => t.transferStatus === 'PENDING').length;
    transferSummary =
      waiting > 0
        ? { text: `${waiting} yêu cầu chờ bạn xác nhận`, attention: true }
        : { text: 'Không có yêu cầu nào chờ bạn', attention: false };
  }

  return { applications: applicationSummary, contracts: contractSummary, transfers: transferSummary };
}

import { apiGet, apiPost, apiPut } from '@/core/api';

// The ward's manual money handling. Mirrors StreetBiz-BE Features/WardFinance/WardFinance.cs.

export type OfflineMethod = 'CASH' | 'BANK_TRANSFER';

export type WardFinanceContractItem = {
  contractId: number;
  slotCode: string;
  zoneName: string;
  vendorName: string;
  vendorPhone: string | null;
  contractStatus: string;
  startDate: string;
  endDate: string;
  outstanding: number;
  overdueCount: number;
  unpaidPenalties: number;
  depositPaid: number;
  depositRefunded: boolean;
};

export type WardFeeItem = {
  feeItemId: number;
  ordinal: number;
  dueDate: string;
  amount: number;
  depositAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt: string | null;
  originalAmount: number | null;
  adjustedAt: string | null;
  adjustmentReason: string | null;
  canEdit: boolean;
};

export type WardPenaltyItem = {
  penaltyId: number;
  violationId: number;
  violationType: string;
  amount: number;
  status: 'UNPAID' | 'PAID' | 'WAIVED' | 'CANCELLED';
  decisionNumber: string | null;
  createdAt: string;
  paidAt: string | null;
  waiverReason: string | null;
};

export type WardDepositRefund = {
  depositPaid: number;
  amount: number;
  deductionReason: string | null;
  method: OfflineMethod;
  reference: string | null;
  refundedAt: string;
};

export type WardFinanceContractDetail = {
  contractId: number;
  slotId: number;
  slotCode: string;
  zoneName: string;
  rentalMode: 'STANDARD' | 'EVENT';
  vendorName: string;
  vendorPhone: string | null;
  contractStatus: string;
  startDate: string;
  endDate: string;
  scheduleTotal: number;
  outstanding: number;
  items: WardFeeItem[];
  penalties: WardPenaltyItem[];
  depositPaid: number;
  depositRefund: WardDepositRefund | null;
  canRefundDeposit: boolean;
  refundBlockedReason: string | null;
  /** The slot's own manual price (monthly for STANDARD, daily for EVENT); null = the zone's. */
  slotPriceOverride: number | null;
  zonePrice: number;
};

export type WardFinanceResult = { message: string };

export const wardFinanceApi = {
  listContracts: () => apiGet<WardFinanceContractItem[]>('/ward/finance/contracts'),
  getContract: (contractId: number) =>
    apiGet<WardFinanceContractDetail>(`/ward/finance/contracts/${contractId}`),
  adjustFeeItem: (
    feeItemId: number,
    body: { newAmount: number | null; newDueDate: string | null; reason: string },
  ) => apiPost<WardFinanceResult>(`/ward/finance/fee-items/${feeItemId}/adjust`, body),
  waiveFeeItem: (feeItemId: number, reason: string) =>
    apiPost<WardFinanceResult>(`/ward/finance/fee-items/${feeItemId}/waive`, { reason }),
  waivePenalty: (penaltyId: number, reason: string) =>
    apiPost<WardFinanceResult>(`/ward/finance/penalties/${penaltyId}/waive`, { reason }),
  recordOfflinePayment: (body: {
    target: 'FEE' | 'PENALTY';
    targetId: number;
    method: OfflineMethod;
    reference: string;
    note: string | null;
  }) => apiPost<WardFinanceResult>('/ward/finance/offline-payments', body),
  setSlotPrice: (slotId: number, priceOverride: number | null, reason: string) =>
    apiPut<WardFinanceResult>(`/ward/finance/slots/${slotId}/price`, { priceOverride, reason }),
  refundDeposit: (
    contractId: number,
    body: {
      amount: number;
      method: OfflineMethod;
      reference: string | null;
      deductionReason: string | null;
    },
  ) => apiPost<WardFinanceResult>(`/ward/finance/contracts/${contractId}/deposit-refund`, body),
};

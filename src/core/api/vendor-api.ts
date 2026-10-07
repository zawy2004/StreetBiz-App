import { apiDelete, apiGet, apiPost, apiPut, apiUploadFile, queryString } from './client';

/**
 * Hộ kinh doanh endpoints: registrations (REG-01…05), sidewalk slots and
 * rentals (SIDE-01…13), finance (FEE-01…05), storefront/menu management and
 * ATTP. Same contracts as StreetBiz-FE's vendor-registration-api, side-api,
 * finance-api, seller-store-api and food-safety-api.
 */

// ---- Registrations ---------------------------------------------------------

export type ApiVendorType = 'FIXED_STOREFRONT' | 'ITINERANT';

export type ApiEvidenceType = 'IDENTITY_DOCUMENT' | 'IDENTITY_DOCUMENT_BACK' | 'PORTRAIT_SELFIE' | 'BUSINESS_LICENSE' | 'ADDRESS_PROOF' | 'OTHER';

export type ApiRegistration = {
  registrationId: number;
  vendorType: ApiVendorType;
  displayName: string;
  declaredAddress: string | null;
  addressLatitude: number | null;
  addressLongitude: number | null;
  wardUnitId: number;
  registrationStatus: string;
  fastTrackFlag: boolean;
  reviewDecisionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  ownerDateOfBirth: string | null;
  idType: string | null;
  permanentAddress: string | null;
  contactAddress: string | null;
  businessLine: string | null;
};

export type ApiEvidence = { evidenceId: number; registrationId: number; evidenceType: ApiEvidenceType; fileUrl: string; uploadedAt: string };

export type RegistrationPayload = {
  vendorType: ApiVendorType;
  displayName: string;
  declaredAddress: string | null;
  addressLatitude: number | null;
  addressLongitude: number | null;
  wardUnitId: number;
  ownerDateOfBirth: string | null;
  ownerGender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  ownerEthnicity: string | null;
  ownerNationality: string | null;
  idType: 'CCCD' | 'PASSPORT' | null;
  idIssuedDate: string | null;
  idIssuedPlace: string | null;
  permanentAddress: string | null;
  contactAddress: string | null;
  businessLine: string | null;
  businessLineCode: string | null;
  capitalAmount: number | null;
  laborCount: number | null;
  plannedStartDate: string | null;
  foodSafetyCommitment: boolean;
  householdMembers: [];
};

export const registrationApi = {
  list: () => apiGet<ApiRegistration[]>('/vendor/registrations'),
  get: (id: string | number) => apiGet<{ registration: ApiRegistration; evidence: ApiEvidence[] }>(`/vendor/registrations/${id}`),
  /** REG-01: the controller wraps the created row in `{ message, data }`. */
  submit: async (payload: RegistrationPayload) => (await apiPost<{ message: string; data: ApiRegistration }>('/vendor/registrations', payload)).data,
  /** REG-02: attach an uploaded file (from `uploadEvidence`). */
  addEvidence: (id: string | number, evidenceType: ApiEvidenceType, fileUrl: string) =>
    apiPost<ApiEvidence>(`/vendor/registrations/${id}/evidence`, {
      evidenceType,
      fileUrl,
      ocrExtractedData: null,
      biometricConsent: false,
    }),
  withdraw: (id: string | number) => apiPost<{ message: string }>(`/vendor/registrations/${id}/withdraw`),
  uploadEvidence: (uri: string) => apiUploadFile<{ fileUrl: string }>('/uploads/evidence', uri),
};

// ---- Sidewalk slots and rentals -------------------------------------------

export type ApiSlot = {
  slotId: number;
  slotCode: string;
  zoneId: number;
  zoneName: string;
  wardUnitId: number;
  latitude: number;
  longitude: number;
  widthMeters: number | null;
  lengthMeters: number | null;
  slotStatus: string;
  pricePerDay: number;
  pricePerMonth: number | null;
  priceDisplayUnit: 'DAY' | 'MONTH';
  availableFrom: string | null;
  availableTo: string | null;
  distanceMeters: number | null;
  hasPower: boolean;
  hasWater: boolean;
  hasTrashBin: boolean;
  tenantName: string | null;
  holdExpiresAt: string | null;
  rentalMode: 'STANDARD' | 'EVENT';
};

export type FeeQuote = { slotId: number; termDays: number; total: number; baseFee: number; referenceFees: number; isReferenceOnly: boolean };

export type ApiApplication = {
  applicationId: number;
  registrationId: number;
  slotId: number;
  applicationMethod: string;
  requestedTermDays: number;
  applicationStatus: string;
  reviewDecisionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type ApiContract = {
  contractId: number;
  applicationId: number;
  slotId: number;
  slotCode: string;
  zoneName: string;
  startDate: string;
  endDate: string;
  contractStatus: string;
  cancellationReason: string | null;
  createdAt: string;
};

export type ApiRenewal = {
  renewalId: number;
  contractId: number;
  requestedTermDays: number;
  renewalStatus: string;
  newEndDate: string | null;
  reviewDecisionReason: string | null;
  createdAt: string;
};

export type ApiPermit = {
  permitId: number;
  contractId: number;
  /** Signed payload the ward officer and buyers scan. */
  qrPayload: string;
  startDate: string;
  endDate: string;
  permitStatus: string;
  contractStatus: string;
  /** What actually applies today (VALID, EXPIRED, SUSPENDED…). */
  effectiveStatus: string;
};

export type ApiTransfer = {
  transferId: number;
  contractId: number;
  fromVendorId: number;
  toVendorId: number;
  transferStatus: string;
  initiatedAt: string;
  acceptedAt: string | null;
  reviewDecisionReason: string | null;
  slotCode: string;
  zoneName: string;
  contractStartDate: string;
  contractEndDate: string;
};

export type ApiAddressChange = {
  addressChangeId: number;
  registrationId: number;
  newAddress: string;
  changeStatus: string;
  conflictResolutionNote: string | null;
  createdAt: string;
};

export const slotsApi = {
  /** SIDE-01: slots around a point (pass includeUnavailable to also see rented ones). */
  near: (lat: number, lng: number, radiusMeters = 1500) =>
    apiGet<ApiSlot[]>(`/sidewalk-slots${queryString({ lat, lng, radiusMeters, includeUnavailable: true, take: 200 })}`),
  get: (slotId: string | number) => apiGet<ApiSlot>(`/sidewalk-slots/${slotId}`),
  quote: (slotId: string | number, termDays: number) => apiGet<FeeQuote>(`/sidewalk-slots/${slotId}/quote${queryString({ termDays })}`),

  applyOpenSlot: (registrationId: number, slotId: number, requestedTermDays: number) =>
    apiPost<{ message: string; data: ApiApplication }>('/vendor/rental-applications/open-slot', {
      registrationId,
      slotId,
      requestedTermDays,
      commitmentsAccepted: true,
    }),
  applications: () => apiGet<ApiApplication[]>('/vendor/rental-applications'),
  application: (id: string | number) => apiGet<ApiApplication>(`/vendor/rental-applications/${id}`),
  withdrawApplication: (id: string | number) => apiPost<{ message: string }>(`/vendor/rental-applications/${id}/withdraw`),

  contracts: (status?: string) => apiGet<ApiContract[]>(`/vendor/rental-contracts${queryString({ status })}`),
  contract: (id: string | number) => apiGet<ApiContract>(`/vendor/rental-contracts/${id}`),
  permit: (contractId: string | number) => apiGet<ApiPermit>(`/vendor/rental-contracts/${contractId}/permit`),
  renewals: (contractId: string | number) => apiGet<ApiRenewal[]>(`/vendor/rental-contracts/${contractId}/renewals`),
  requestRenewal: (contractId: string | number, requestedTermDays: number) =>
    apiPost<{ message: string; data: ApiRenewal }>(`/vendor/rental-contracts/${contractId}/renewals`, { requestedTermDays }),
  /** SIDE-07: return the slot early. */
  cancelContract: (contractId: string | number, reason: string | null) =>
    apiPost<{ message: string }>(`/vendor/rental-contracts/${contractId}/cancel`, { reason }),

  proposeSlot: (body: { registrationId: number; zoneId: number; latitude: number; longitude: number; widthMeters?: number; lengthMeters?: number; proposalPhotoUrl: string }) =>
    apiPost<{ message: string }>('/vendor/slot-proposals', body),

  addressChanges: () => apiGet<ApiAddressChange[]>('/vendor/address-changes'),
  requestAddressChange: (registrationId: number, newAddress: string) =>
    apiPost<{ message: string; data: ApiAddressChange }>('/vendor/address-changes', { registrationId, newAddress }),

  requestTransfer: (contractId: number, toVendorPhone: string) =>
    apiPost<{ message: string; data: ApiTransfer }>('/vendor/slot-transfers', { contractId, toVendorPhone }),
  transfers: (direction: 'outgoing' | 'incoming') => apiGet<ApiTransfer[]>(`/vendor/slot-transfers${queryString({ direction })}`),
  acceptTransfer: (id: string | number) => apiPost<{ message: string }>(`/vendor/slot-transfers/${id}/accept`),
  declineTransfer: (id: string | number) => apiPost<{ message: string }>(`/vendor/slot-transfers/${id}/decline`),
};

// ---- Finance ---------------------------------------------------------------

export type FeeItemDto = { feeItemId: number; contractId: number; slotCode: string; periodLabel: string; dueDate: string; amount: number; itemStatus: string; paidAt: string | null };
export type PenaltyDto = { penaltyId: number; violationId: number; violationType: string; violationLabel: string; slotCode: string | null; amount: number; penaltyStatus: string; issuedAt: string; paidAt: string | null };
export type FinanceSummaryDto = { feeDue: number; penaltyDue: number; totalDue: number; overdueCount: number; nextDueDate: string | null };
export type PaymentTransactionDto = { transactionId: number; purpose: string; provider: string; amount: number; transactionStatus: string; referenceLabel: string; slotCode: string | null; createdAt: string };
export type VendorViolationDto = { violationId: number; violationType: string; violationLabel: string; description: string | null; evidenceUrl: string | null; source: string; recordedAt: string; slotCode: string | null; penaltyAmount: number | null; penaltyStatus: string | null };
export type InvoiceDto = { invoiceId: number; invoiceNumber: string; kind: string; amount: number; issuedAt: string; periodLabel: string | null };
export type InvoiceDetailDto = InvoiceDto & { slotCode: string | null; violationLabel: string | null; paymentProvider: string | null; paidAt: string | null };
export type FinanceCheckoutDto = { transactionId: number; purpose: string; referenceId: number; provider: string; amount: number; paymentUrl: string };

export const financeApi = {
  summary: () => apiGet<FinanceSummaryDto>('/vendor/finance/summary'),
  fees: () => apiGet<FeeItemDto[]>('/vendor/finance/fees'),
  penalties: () => apiGet<PenaltyDto[]>('/vendor/finance/penalties'),
  payFee: (feeItemId: string | number, provider: 'MOMO' | 'ZALOPAY', key: string) =>
    apiPost<FinanceCheckoutDto>(`/vendor/finance/fees/${feeItemId}/checkout`, { provider }, { headers: { 'Idempotency-Key': key } }),
  payPenalty: (penaltyId: string | number, provider: 'MOMO' | 'ZALOPAY', key: string) =>
    apiPost<FinanceCheckoutDto>(`/vendor/finance/penalties/${penaltyId}/checkout`, { provider }, { headers: { 'Idempotency-Key': key } }),
  /** Development-only stand-in for the provider's signed callback. */
  sandboxConfirm: (transactionId: number) => apiPost<{ outcome: string }>(`/vendor/finance/payments/${transactionId}/sandbox-confirm`),
  syncPayment: (transactionId: number) => apiPost<{ transactionId: number; status: 'PENDING' | 'SUCCESS' | 'FAILED' }>(`/vendor/finance/payments/${transactionId}/sync`),
  payments: () => apiGet<PaymentTransactionDto[]>('/vendor/finance/payments'),
  violations: () => apiGet<VendorViolationDto[]>('/vendor/finance/violations'),
  invoices: () => apiGet<InvoiceDto[]>('/vendor/finance/invoices'),
  invoice: (id: string | number) => apiGet<InvoiceDetailDto>(`/vendor/finance/invoices/${id}`),
};

// ---- Storefront, menu and ATTP --------------------------------------------

export type SellerStore = { storefrontId: number; registrationId: number; contractId: number; name: string; description: string | null; availabilityStatus: string };
export type SellerMenuItem = {
  menuItemId: number;
  storefrontId: number;
  categoryId: number;
  name: string;
  description: string | null;
  unitPrice: number;
  availabilityStatus: string;
  imageUrl: string | null;
  categoryName: string;
  requiresFoodSafety: boolean;
  foodSafetyStatus: 'NOT_REQUIRED' | 'MISSING' | 'PENDING' | 'APPROVED';
};
export type SellerCategory = { categoryId: number; name: string; requiresFoodSafety: boolean };
export type MenuInput = { categoryId: number; name: string; description: string | null; unitPrice: number; availabilityStatus: string; imageUrl?: string | null };

export type FoodSafetyApplication = {
  applicationId: number;
  storefrontId: number;
  storefrontName: string;
  status: string;
  vendorNote: string | null;
  reviewReason: string | null;
  submittedAt: string;
  expiresOn: string | null;
  dishes: { menuItemId: number; name: string }[];
};

export const sellerApi = {
  stores: () => apiGet<SellerStore[]>('/seller/storefronts'),
  saveStore: (id: number | null, input: Omit<SellerStore, 'storefrontId'>) =>
    id === null ? apiPost<SellerStore>('/seller/storefronts', input) : apiPut<SellerStore>(`/seller/storefronts/${id}`, input),
  categories: () => apiGet<SellerCategory[]>('/seller/storefronts/food-categories'),
  menu: (storeId: string | number) => apiGet<{ items: SellerMenuItem[]; maxItems: number }>(`/seller/storefronts/${storeId}/menu-items`),
  saveItem: (storeId: string | number, id: string | number | null, input: MenuInput) =>
    id === null
      ? apiPost<SellerMenuItem>(`/seller/storefronts/${storeId}/menu-items`, input)
      : apiPut<SellerMenuItem>(`/seller/storefronts/${storeId}/menu-items/${id}`, input),
  archiveItem: (storeId: string | number, id: string | number) => apiDelete<void>(`/seller/storefronts/${storeId}/menu-items/${id}`),
  uploadMenuImage: (uri: string) => apiUploadFile<{ fileUrl: string }>('/uploads/menu-images', uri),

  foodSafety: () => apiGet<FoodSafetyApplication[]>('/vendor/food-safety'),
  submitFoodSafety: (input: { storefrontId: number; menuItemIds: number[]; note: string | null; evidence: { evidenceType: string; fileUrl: string }[] }) =>
    apiPost<FoodSafetyApplication>('/vendor/food-safety', input),
};

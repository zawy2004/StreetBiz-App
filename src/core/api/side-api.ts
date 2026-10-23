import { ApiError } from '@/core/api/problem';
import { requestViaHttp } from '@/core/api/client';

// Sidewalk Slot & Rental (SIDE-01..13) client: a typed fetch wrapper reading
// the same bearer token as the rest of the app (core/api/token-storage,
// filled in by the real sign-in flow) rather than its own session -- a
// leftover VendorConnection paste-token workaround was removed once
// Authentication & Vendor Onboarding landed a real JWT for RoleGuard to sit
// behind on every /vendor/* route.

export type SidewalkSlot = {
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
  source: string;
  pricePerDay: number;
  availableFrom: string | null;
  availableTo: string | null;
  distanceMeters: number | null;
  /** The slot photos in order; the first is the cover. Empty when the ward has not added any. */
  imageUrls: string[];
  hasPower: boolean;
  hasWater: boolean;
  hasTrashBin: boolean;
  /** Advisory only; the ward assigns it, nothing enforces it on an application. */
  businessCategory: BusinessCategory | null;
  /** Only present for a slot with an ACTIVE contract. */
  tenantName: string | null;
  /** UTC ISO time a live hold on this slot lapses; null when nobody holds it. */
  holdExpiresAt: string | null;
  /** The zone's rental-term model -- STANDARD zones offer a month quick-select, EVENT zones
   * keep the free-text day count (and may not outrun eventEndDate). */
  priceDisplayUnit: 'DAY' | 'MONTH';
  pricePerMonth: number | null;
  rentalMode: 'STANDARD' | 'EVENT';
  eventEndDate: string | null;
  /** Rent of one month of a STANDARD zone (pricePerMonth, else pricePerDay x 30). */
  monthlyPrice: number;
  /** STANDARD only: % off the rent of a 3/6/12-month term; null = no discount. */
  quarterDiscountPercent: number | null;
};

export type BusinessCategory = 'FOOD_BEVERAGE' | 'RETAIL' | 'SERVICES' | 'CRAFTS' | 'GENERAL';

/** PER_DAY x term days; PER_TERM once per term (again on renewal); ONE_TIME and the
 * refundable DEPOSIT once, on the first contract only. */
export type FeeCalcBasis = 'PER_DAY' | 'PER_TERM' | 'ONE_TIME' | 'DEPOSIT';

export type FeeComponent = {
  componentId: number;
  componentName: string;
  calcBasis: FeeCalcBasis;
  unitAmount: number;
};

export type StreetFeatureType =
  | 'TRANSFORMER'
  | 'HYDRANT'
  | 'TREE'
  | 'LIGHT_POLE'
  | 'BUS_STOP'
  | 'PARKING';

export type StreetFeature = {
  featureId: number;
  featureType: StreetFeatureType;
  label: string;
  latitude: number;
  longitude: number;
  /** True means no slot can operate here (e.g. a transformer corridor). */
  blocksBusiness: boolean;
  note: string | null;
};

export type SidewalkZone = {
  zoneId: number;
  zoneName: string;
  zoneCode: string | null;
  regulationRef: string | null;
  segmentFrom: string | null;
  segmentTo: string | null;
  /** yyyy-mm-dd */
  applicationDeadline: string | null;
  wardUnitId: number;
  wardName: string;
  contactName: string | null;
  contactPhone: string | null;
  pricePerDay: number;
  availableFrom: string | null;
  availableTo: string | null;
  feeComponents: FeeComponent[];
  features: StreetFeature[];
  rentalMode: 'STANDARD' | 'EVENT';
  /** Rent of one month of a STANDARD zone. */
  monthlyPrice: number;
  quarterDiscountPercent: number | null;
};

export type FeeQuoteLine = {
  /** RENT is by the day, or by the month (PER_MONTH) for a STANDARD zone; DISCOUNT is the
   * quarterly discount (negative); FEE is a zone fee component; DEPOSIT the refundable deposit. */
  kind: 'RENT' | 'DISCOUNT' | 'FEE' | 'DEPOSIT';
  label: string | null;
  calcBasis: FeeCalcBasis | 'PER_MONTH';
  unitAmount: number;
  quantity: number;
  amount: number;
};

export type FeeQuote = {
  slotId: number;
  termDays: number;
  lines: FeeQuoteLine[];
  total: number;
  /** The rent after any quarterly discount. */
  baseFee: number;
  /** Zone fee components (deposit excluded). */
  referenceFees: number;
  /** Always false now that approval bills the fees too; kept for older servers. */
  isReferenceOnly: boolean;
  /** Refundable deposit: part of total, but not a fee. */
  deposit: number;
};

export type SlotHold = {
  slotId: number;
  registrationId: number;
  heldAt: string;
  /** UTC ISO time the hold lapses. */
  expiresAt: string;
};

export type SlotProposal = {
  slotId: number;
  slotCode: string;
  latitude: number;
  longitude: number;
  proposalReviewStatus: string;
  proposalPhotoUrl: string;
  proposalReviewReason: string | null;
  createdAt: string;
};

export type RentalApplication = {
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

export type RentalContract = {
  contractId: number;
  applicationId: number;
  slotId: number;
  slotCode: string;
  zoneName: string;
  startDate: string;
  endDate: string;
  contractStatus: string;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type RenewalRequest = {
  renewalId: number;
  contractId: number;
  requestedTermDays: number;
  renewalStatus: string;
  newEndDate: string | null;
  reviewDecisionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type DigitalPermit = {
  permitId: number;
  contractId: number;
  qrPayload: string;
  startDate: string;
  endDate: string;
  permitStatus: string;
  contractStatus: string;
  effectiveStatus: string;
  /** `{base}/q/{qrPayload}`: what the QR draws so an ordinary camera opens the public check page.
   * Null when the server has no public base URL (or from an older server): draw qrPayload then. */
  qrUrl?: string | null;
};

export type AddressChangeRequest = {
  addressChangeId: number;
  registrationId: number;
  newAddress: string;
  newLatitude: number | null;
  newLongitude: number | null;
  releasedContractId: number | null;
  requestedNewSlotId: number | null;
  changeStatus: string;
  conflictResolutionNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type SlotTransferRequest = {
  transferId: number;
  contractId: number;
  fromVendorId: number;
  toVendorId: number;
  transferStatus: string;
  initiatedAt: string;
  acceptedAt: string | null;
  reviewDecisionReason: string | null;
  reviewedAt: string | null;
  /** The slot and term being handed over. The receiver cannot read the sender's contract, so they come with the request. */
  slotCode: string;
  zoneName: string;
  contractStartDate: string;
  contractEndDate: string;
};

type SlotSearchFilters = {
  wardUnitId?: number;
  zoneId?: number;
  /** Also return RENTED/SUSPENDED/etc slots, not just AVAILABLE ones. */
  includeUnavailable?: boolean;
  take?: number;
};

export type SearchSlotsParams =
  | ({ lat: number; lng: number; radiusMeters: number } & SlotSearchFilters)
  | ({ minLat: number; maxLat: number; minLng: number; maxLng: number } & SlotSearchFilters)
  | ({ zoneId: number } & SlotSearchFilters);

export class SideApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function sideRequest<T>(
  path: string,
  init: RequestInit = {},
  // Kept for call-site compatibility with the web; the shared client supplies the token.
  _token?: string,
): Promise<T> {
  try {
    return await requestViaHttp<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError) throw new SideApiError(error.status, error.message);
    throw error;
  }
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [
    string,
    string | number | boolean,
  ][];
  return entries.length ? '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
}

export const sideApi = {
  // SIDE-01/02
  searchSlots: (params: SearchSlotsParams) =>
    sideRequest<SidewalkSlot[]>(`/sidewalk-slots${query(params)}`),
  getSlot: (slotId: number) => sideRequest<SidewalkSlot>(`/sidewalk-slots/${slotId}`),
  getZone: (zoneId: number) => sideRequest<SidewalkZone>(`/sidewalk-zones/${zoneId}`),
  /** Informational price estimate; never stored. */
  getSlotQuote: (slotId: number, termDays: number) =>
    sideRequest<FeeQuote>(`/sidewalk-slots/${slotId}/quote${query({ termDays })}`),

  // 15-minute slot holds
  listHolds: (registrationId: number) =>
    sideRequest<SlotHold[]>(`/vendor/slot-holds${query({ registrationId })}`),
  createHold: (body: { registrationId: number; slotId: number }) =>
    sideRequest<{ message: string; data: SlotHold }>('/vendor/slot-holds', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  releaseHold: (slotId: number, registrationId: number) =>
    sideRequest<{ message: string }>(`/vendor/slot-holds/${slotId}${query({ registrationId })}`, {
      method: 'DELETE',
    }),

  // SIDE-03A/03B/04
  submitOpenSlotApplication: (body: {
    registrationId: number;
    slotId: number;
    requestedTermDays: number;
    /** The backend rejects the application unless this is true. */
    commitmentsAccepted: boolean;
  }) =>
    sideRequest<{ message: string; data: RentalApplication }>(
      '/vendor/rental-applications/open-slot',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  submitAdjacentApplication: (body: {
    registrationId: number;
    slotId: number;
    requestedTermDays: number;
  }) =>
    sideRequest<{ message: string; data: RentalApplication }>(
      '/vendor/rental-applications/adjacent',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  listApplications: () => sideRequest<RentalApplication[]>('/vendor/rental-applications'),
  getApplication: (applicationId: number) =>
    sideRequest<RentalApplication>(`/vendor/rental-applications/${applicationId}`),
  withdrawApplication: (applicationId: number) =>
    sideRequest<{ message: string }>(`/vendor/rental-applications/${applicationId}/withdraw`, {
      method: 'POST',
    }),

  // SIDE-05/06/07/08
  listContracts: (status?: string) =>
    sideRequest<RentalContract[]>(`/vendor/rental-contracts${query({ status })}`),
  getContract: (contractId: number) =>
    sideRequest<RentalContract>(`/vendor/rental-contracts/${contractId}`),
  requestRenewal: (contractId: number, requestedTermDays: number) =>
    sideRequest<{ message: string; data: RenewalRequest }>(
      `/vendor/rental-contracts/${contractId}/renewals`,
      { method: 'POST', body: JSON.stringify({ requestedTermDays }) },
    ),
  listRenewals: (contractId: number) =>
    sideRequest<RenewalRequest[]>(`/vendor/rental-contracts/${contractId}/renewals`),
  withdrawRenewal: (contractId: number, renewalId: number) =>
    sideRequest<{ message: string }>(
      `/vendor/rental-contracts/${contractId}/renewals/${renewalId}/withdraw`,
      { method: 'POST' },
    ),
  cancelContract: (contractId: number, reason: string | null) =>
    sideRequest<{ message: string }>(`/vendor/rental-contracts/${contractId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  getPermit: (contractId: number) =>
    sideRequest<DigitalPermit>(`/vendor/rental-contracts/${contractId}/permit`),

  // SIDE-11
  proposeSlot: (body: {
    registrationId: number;
    zoneId: number;
    latitude: number;
    longitude: number;
    widthMeters?: number;
    lengthMeters?: number;
    proposalPhotoUrl: string;
  }) =>
    sideRequest<{ message: string; data: SlotProposal }>('/vendor/slot-proposals', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listProposals: () => sideRequest<SlotProposal[]>('/vendor/slot-proposals'),

  // SIDE-09/10
  requestAddressChange: (body: {
    registrationId: number;
    newAddress: string;
    newLatitude?: number | null;
    newLongitude?: number | null;
    releasedContractId?: number | null;
    requestedNewSlotId?: number | null;
  }) =>
    sideRequest<{ message: string; data: AddressChangeRequest }>('/vendor/address-changes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listAddressChanges: () => sideRequest<AddressChangeRequest[]>('/vendor/address-changes'),

  // SIDE-12/13
  requestTransfer: (body: { contractId: number; toVendorPhone: string }) =>
    sideRequest<{ message: string; data: SlotTransferRequest }>('/vendor/slot-transfers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listTransfers: (direction: 'outgoing' | 'incoming') =>
    sideRequest<SlotTransferRequest[]>(`/vendor/slot-transfers${query({ direction })}`),
  acceptTransfer: (transferId: number) =>
    sideRequest<{ message: string }>(`/vendor/slot-transfers/${transferId}/accept`, {
      method: 'POST',
    }),
  declineTransfer: (transferId: number) =>
    sideRequest<{ message: string }>(`/vendor/slot-transfers/${transferId}/decline`, {
      method: 'POST',
    }),
};

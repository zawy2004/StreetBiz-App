import { appendFile, type PickedFile } from '@/core/api/upload';
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from '@/core/api';
import { apiUpload } from '@/core/api/client';
import type { FeeCalcBasis } from '@/core/api/side-api';

// WARD-01/02/03 Ward Configuration. Mirrors StreetBiz-BE Features/WardConfiguration/Contracts.cs.

export type PlacementSeverity = 'BLOCK' | 'WARN';
export type PlacementIssue = {
  severity: PlacementSeverity;
  code: string;
  message: string;
  featureId: number | null;
  slotId: number | null;
  distanceMeters: number | null;
};
export type PlacementCheck = { boundaryVerified: boolean; issues: PlacementIssue[] };

export type WardSlot = {
  slotId: number;
  slotCode: string;
  zoneId: number;
  zoneName: string;
  latitude: number;
  longitude: number;
  widthMeters: number | null;
  lengthMeters: number | null;
  status: 'AVAILABLE' | 'PENDING_APPLICATION' | 'ACTIVE' | 'SUSPENDED';
  source: 'WARD_DEFINED' | 'VENDOR_PROPOSED';
  hasPower: boolean;
  hasWater: boolean;
  hasTrashBin: boolean;
  businessCategory: string | null;
  canHardDelete: boolean;
  canEditGeometry: boolean;
  versionToken: string;
  /** Photos in order; the first is the cover. */
  imageUrls: string[];
};

export type StreetFeatureType =
  'TRANSFORMER' | 'HYDRANT' | 'TREE' | 'LIGHT_POLE' | 'BUS_STOP' | 'PARKING';
export type WardStreetFeature = {
  featureId: number;
  zoneId: number;
  featureType: StreetFeatureType;
  label: string;
  latitude: number;
  longitude: number;
  blocksBusiness: boolean;
  note: string | null;
  clearanceMeters: number | null;
  versionToken: string;
};

export type WardSlotGrid = {
  slots: WardSlot[];
  features: WardStreetFeature[];
  boundaryConfigured: boolean;
  clearanceCheckEnabled: boolean;
};

export type SlotPlacementInput = {
  zoneId: number;
  latitude: number;
  longitude: number;
  widthMeters: number;
  lengthMeters: number;
};

export type SlotFacilities = {
  hasPower: boolean;
  hasWater: boolean;
  hasTrashBin: boolean;
  businessCategory: string | null;
};
/** Omit to leave a slot's photos as they are; a list replaces them all (first = cover, max 6). */
export type SlotPhotos = { imageUrls?: string[] };

export type WarningAcknowledgement = { acknowledgeWarnings: boolean; warningReason: string | null };

export type SlotMutationResult = { slot: WardSlot; check: PlacementCheck };

export type BatchCandidate = {
  index: number;
  proposedCode: string;
  latitude: number;
  longitude: number;
  issues: PlacementIssue[];
};
export type BatchPreview = { boundaryVerified: boolean; candidates: BatchCandidate[] };

export type StreetFeatureInput = {
  zoneId: number;
  featureType: StreetFeatureType;
  label: string;
  latitude: number;
  longitude: number;
  blocksBusiness: boolean;
  note: string | null;
};

export type ZoneFeeComponentInput = {
  componentName: string;
  calcBasis: FeeCalcBasis;
  unitAmount: number;
};
export type ZoneFeeComponent = ZoneFeeComponentInput & { componentId: number; sortOrder: number };

export type WardZone = {
  zoneId: number;
  zoneName: string;
  zoneCode: string | null;
  pricePerDay: number;
  availableFrom: string | null;
  availableTo: string | null;
  isOvernight: boolean;
  regulationRef: string | null;
  segmentFrom: string | null;
  segmentTo: string | null;
  applicationDeadline: string | null;
  slotCount: number;
  activeSlotCount: number;
  featureCount: number;
  feeComponents: ZoneFeeComponent[];
  versionToken: string;
  /** MONTH: the officer entered pricePerMonth, which whole-month STANDARD terms are billed at;
   * pricePerDay is then derived from it for EVENT and part-month terms. */
  priceDisplayUnit: 'DAY' | 'MONTH';
  pricePerMonth: number | null;
  rentalMode: 'STANDARD' | 'EVENT';
  eventStartDate: string | null;
  eventEndDate: string | null;
  /** STANDARD only: % off the rent of a 3/6/12-month term; null = no discount. */
  quarterDiscountPercent: number | null;
};

export type UpsertZoneRequest = {
  zoneName: string;
  zoneCode: string;
  pricePerDay: number;
  availableFrom: string | null;
  availableTo: string | null;
  /** All three null on update = keep the stored permitting document. */
  regulationNumber: string | null;
  regulationIssuedOn: string | null;
  regulationIssuer: string | null;
  segmentFrom: string | null;
  segmentTo: string | null;
  applicationDeadline: string | null;
  feeComponents: ZoneFeeComponentInput[];
  changeReason: string | null;
  versionToken: string | null;
  priceDisplayUnit: 'DAY' | 'MONTH';
  pricePerMonth: number | null;
  rentalMode: 'STANDARD' | 'EVENT';
  eventStartDate: string | null;
  eventEndDate: string | null;
  quarterDiscountPercent: number | null;
};

export type ZoneImpactItem = {
  kind: 'RENTAL_APPLICATION' | 'RENEWAL';
  id: number;
  slotCode: string;
  vendorName: string;
  termDays: number;
  currentTotal: number;
  newTotal: number;
};
export type ZoneImpactPreview = {
  /** Price-per-day OR fee components changed -- either changes what a pending application/renewal is billed. */
  amountChanged: boolean;
  hoursChanged: boolean;
  pendingApplications: ZoneImpactItem[];
  openRenewals: ZoneImpactItem[];
  activeContractsAffectedByHours: number;
  totalDelta: number;
  vendorsToNotify: number;
};

export type ConfigHistoryEntry = {
  auditId: number;
  action: string;
  actorName: string;
  createdAt: string;
  details: string | null;
};

// -- AIC-07: zone price suggestion --
export type ZonePriceSuggestion = {
  zoneId: number;
  zoneName: string;
  currentPricePerDay: number;
  windowDays: number;
  slotCount: number;
  occupiedSlotDays: number;
  availableSlotDays: number;
  occupancyPercent: number;
  applicationsInWindow: number;
  rejectedApplications: number;
  pendingApplications: number;
  activeHolds: number;
  direction: 'RAISE' | 'LOWER' | 'KEEP' | 'INSUFFICIENT_DATA';
  baselinePricePerDay: number;
  suggestedPricePerDay: number;
  minAllowedPricePerDay: number;
  maxAllowedPricePerDay: number;
  explanation: string;
  isAiGenerated: boolean;
  aiLogId: number | null;
};

export type PenaltyRate = {
  scheduleId: number;
  amount: number;
  bracketMin: number | null;
  bracketMax: number | null;
  legalBasis: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  isInUse: boolean;
  actorName: string;
};
export type WardPenaltyType = {
  violationType: string;
  description: string;
  isActive: boolean;
  hasLegalBasis: boolean;
  current: PenaltyRate | null;
  scheduled: PenaltyRate | null;
};
export type SetPenaltyRateRequest = {
  violationType: string;
  documentRef: string;
  article: string;
  clause: string;
  point: string | null;
  behavior: string;
  bracketMin: number;
  bracketMax: number;
  effectiveFrom: string;
  expectedCurrentScheduleId: number | null;
};

/** Null fields mean the feature is off for this ward -- no "consider revoking" banner, no
 * overdue-penalty reminder sweep. A ward opts in explicitly. */
export type WardCompliancePolicy = {
  violationThresholdCount: number | null;
  violationWindowDays: number | null;
  unpaidPenaltyGraceDays: number | null;
  updatedAt: string | null;
  updatedByName: string | null;
};
export type UpsertWardCompliancePolicyRequest = {
  violationThresholdCount: number | null;
  violationWindowDays: number | null;
  unpaidPenaltyGraceDays: number | null;
};

const token = (versionToken: string) => `versionToken=${encodeURIComponent(versionToken)}`;

export const wardConfigApi = {
  // WARD-03
  penaltyOverview: () => apiGet<WardPenaltyType[]>('/ward/penalty-schedules/overview'),
  penaltyHistory: (violationType: string) =>
    apiGet<PenaltyRate[]>(
      `/ward/penalty-schedules/history?violationType=${encodeURIComponent(violationType)}`,
    ),
  setPenaltyRate: (request: SetPenaltyRateRequest) =>
    apiPost<WardPenaltyType>('/ward/penalty-schedules', request),
  cancelPenaltyRate: (scheduleId: number) =>
    apiDelete<WardPenaltyType>(`/ward/penalty-schedules/${scheduleId}`),

  // WARD-02
  listZones: () => apiGet<WardZone[]>('/ward/pricing-zones'),
  createZone: (request: UpsertZoneRequest) => apiPost<WardZone>('/ward/pricing-zones', request),
  updateZone: (zoneId: number, request: UpsertZoneRequest) =>
    apiPut<WardZone>(`/ward/pricing-zones/${zoneId}`, request),
  deleteZone: (zone: WardZone) =>
    apiDelete<void>(`/ward/pricing-zones/${zone.zoneId}?${token(zone.versionToken)}`),
  previewZoneImpact: (
    zoneId: number,
    pricePerDay: number,
    availableFrom: string | null,
    availableTo: string | null,
    feeComponents: ZoneFeeComponentInput[],
    pricing?: {
      priceDisplayUnit: 'DAY' | 'MONTH';
      pricePerMonth: number | null;
      quarterDiscountPercent: number | null;
    },
  ) =>
    apiPost<ZoneImpactPreview>(`/ward/pricing-zones/${zoneId}/impact-preview`, {
      pricePerDay,
      availableFrom,
      availableTo,
      feeComponents,
      ...pricing,
    }),
  zoneHistory: (zoneId: number) =>
    apiGet<ConfigHistoryEntry[]>(`/ward/pricing-zones/${zoneId}/history`),
  /** AIC-07: a suggested price from 90 days of occupancy, within +-20% of the current price.
   * Advisory only -- "Áp dụng" only fills the price field; saving still goes through updateZone. */
  priceSuggestion: (zoneId: number) =>
    apiGet<ZonePriceSuggestion>(`/ward/pricing-zones/${zoneId}/price-suggestion`),

  // Phase A - compliance policy
  getCompliancePolicy: () => apiGet<WardCompliancePolicy>('/ward/compliance-policy'),
  upsertCompliancePolicy: (request: UpsertWardCompliancePolicyRequest) =>
    apiPut<WardCompliancePolicy>('/ward/compliance-policy', request),

  // WARD-01
  slotGrid: (zoneId?: number) =>
    apiGet<WardSlotGrid>(`/ward/slot-grid${zoneId ? `?zoneId=${zoneId}` : ''}`),
  checkPlacement: (input: SlotPlacementInput, ignoreSlotId?: number) =>
    apiPost<PlacementCheck>(
      `/ward/slot-grid/check${ignoreSlotId ? `?ignoreSlotId=${ignoreSlotId}` : ''}`,
      input,
    ),
  createSlot: (
    input: SlotPlacementInput &
      SlotFacilities &
      SlotPhotos &
      WarningAcknowledgement & { slotCode: string | null },
  ) => apiPost<SlotMutationResult>('/ward/slot-grid', input),
  updateSlot: (
    slot: WardSlot,
    input: SlotPlacementInput &
      SlotFacilities &
      SlotPhotos &
      WarningAcknowledgement & { slotCode: string },
  ) =>
    apiPut<SlotMutationResult>(`/ward/slot-grid/${slot.slotId}`, {
      ...input,
      versionToken: slot.versionToken,
    }),
  /** Stores one slot photo (public) and returns the URL to send in `imageUrls`. */
  uploadSlotImage: (file: PickedFile) => {
    const form = new FormData();
    appendFile(form, file);
    return apiUpload<{ fileUrl: string }>('/uploads/slot-images', form);
  },
  setSlotStatus: (slot: WardSlot, status: 'AVAILABLE' | 'SUSPENDED', reason: string) =>
    apiPut<WardSlot>(`/ward/slot-grid/${slot.slotId}/status`, {
      status,
      reason,
      versionToken: slot.versionToken,
    }),
  deleteSlot: (slot: WardSlot) =>
    apiDelete<void>(`/ward/slot-grid/${slot.slotId}?${token(slot.versionToken)}`),
  previewBatch: (request: {
    zoneId: number;
    startLatitude: number;
    startLongitude: number;
    endLatitude: number;
    endLongitude: number;
    widthMeters: number;
    lengthMeters: number;
    gapMeters: number;
  }) => apiPost<BatchPreview>('/ward/slot-grid/batch-preview', request),
  createBatch: (
    request: {
      zoneId: number;
      positions: { latitude: number; longitude: number }[];
      widthMeters: number;
      lengthMeters: number;
    } & SlotFacilities &
      WarningAcknowledgement,
  ) => apiPost<WardSlot[]>('/ward/slot-grid/batch', request),
  slotHistory: (slotId: number) =>
    apiGet<ConfigHistoryEntry[]>(`/ward/slot-grid/${slotId}/history`),
  createFeature: (input: StreetFeatureInput) =>
    apiPost<{ feature: WardStreetFeature; affectedSlots: PlacementIssue[] }>(
      '/ward/street-features',
      { ...input, versionToken: null },
    ),
  updateFeature: (feature: WardStreetFeature, input: StreetFeatureInput) =>
    apiPut<{ feature: WardStreetFeature; affectedSlots: PlacementIssue[] }>(
      `/ward/street-features/${feature.featureId}`,
      {
        ...input,
        versionToken: feature.versionToken,
      },
    ),
  deleteFeature: (feature: WardStreetFeature) =>
    apiDelete<void>(`/ward/street-features/${feature.featureId}?${token(feature.versionToken)}`),
};

export const CONFLICT_MESSAGE =
  'Dữ liệu vừa được cán bộ khác cập nhật. Vui lòng tải lại trước khi lưu.';

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'conflict';
}

export function errorMessage(error: unknown, fallback = 'Không thực hiện được thao tác.'): string {
  if (isConflict(error)) return CONFLICT_MESSAGE;
  if (error instanceof ApiError) {
    const firstField = Object.values(error.fieldErrors)[0]?.[0];
    return firstField ?? error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export const featureTypeLabels: Record<StreetFeatureType, string> = {
  TRANSFORMER: 'Trạm biến áp / tủ điện',
  HYDRANT: 'Trụ nước chữa cháy',
  TREE: 'Cây xanh',
  LIGHT_POLE: 'Trụ đèn',
  BUS_STOP: 'Trạm dừng xe buýt',
  PARKING: 'Khu để xe',
};

export const slotStatusLabels: Record<WardSlot['status'], string> = {
  AVAILABLE: 'Trống',
  PENDING_APPLICATION: 'Đang có đơn',
  ACTIVE: 'Đang cho thuê',
  SUSPENDED: 'Tạm ngưng',
};

export const businessCategoryLabels: Record<string, string> = {
  FOOD_BEVERAGE: 'Ăn uống',
  RETAIL: 'Bán lẻ',
  SERVICES: 'Dịch vụ',
  CRAFTS: 'Thủ công',
  GENERAL: 'Tổng hợp',
};

/** Haversine distance in metres; same formula as the backend's GeoMath.DistanceMeters. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export const MAX_BATCH_SLOTS = 50;

/** How many slots SlotLine.Positions will lay along a segment; 0 when the segment is shorter than one slot. */
export function batchSlotCount(segmentMeters: number, lengthMeters: number, gapMeters: number): number {
  if (segmentMeters < lengthMeters) return 0;
  return Math.min(
    MAX_BATCH_SLOTS,
    Math.floor((segmentMeters - lengthMeters) / (lengthMeters + gapMeters)) + 1,
  );
}

/** Calendar date in Vietnam (UTC+7) of a UTC timestamp the backend sends without a "Z". */
export function vnDateOf(isoUtc: string): string {
  const utc = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(isoUtc) ? isoUtc : `${isoUtc}Z`);
  return new Date(utc.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function todayVn(): string {
  return vnDateOf(new Date().toISOString());
}

export function formatDateVn(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** "HH:mm:ss" from the API -> "HH:mm" for display and <input type="time">. */
export function hhmm(time: string | null): string {
  return time ? time.slice(0, 5) : '';
}

/** Keeps "HH:mm" from <input type="time"> in the "HH:mm:ss" shape System.Text.Json expects for TimeOnly. */
export function toApiTime(value: string): string | null {
  return value ? `${value.slice(0, 5)}:00` : null;
}

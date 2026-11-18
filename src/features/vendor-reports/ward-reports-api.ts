import { apiGet, apiPost } from '@/core/api';
import type { ReportPriceEvidence, ReportResolution, VendorReportType } from '@/features/vendor-map/community-api';

/**
 * WARD-19 / AIB-01: citizen reports about vendors, as the officer of their ward sees them. Another
 * ward's report is not found (404); a platform administrator is refused (BR-44). The system's notes
 * and the [AI] reading of the photo only advise: nothing here closes a report on its own (BR-41/43).
 */

export type WardReportStatus = 'PENDING' | 'REVIEWED' | 'DISMISSED';

export type WardVendorReportSummary = {
  reportId: number;
  reason: string;
  status: WardReportStatus;
  createdAt: string;
  vendorName: string | null;
  slotCode: string | null;
  hasPhoto: boolean;
  reportType: VendorReportType;
  dueAt: string | null;
  isOverdue: boolean;
  resolution: ReportResolution | null;
};

/** Computed from the permit and contract records (not AI). */
export type PermitPrecheck = {
  permitId: number;
  permitStatus: string | null;
  contractStatus: string | null;
  slotCode: string | null;
  validNow: boolean;
  slotMatchesReport: boolean;
};

/** AIB-01. `aiAvailable` false: the photo has not been read (or there is none). */
export type VendorReportAssist = {
  aiAvailable: boolean;
  signageText: string | null;
  locationText: string | null;
  permitVisible: string | null;
  description: string | null;
  flags: string[];
  permitCheck: PermitPrecheck | null;
  generatedAt: string | null;
  aiLogId: number | null;
  disclaimer: string;
};

export type VendorReportOutcome = {
  resolution: ReportResolution;
  note: string | null;
  refundAmount: number | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
};

export type WardVendorReport = {
  reportId: number;
  reason: string;
  evidenceUrl: string | null;
  status: WardReportStatus;
  createdAt: string;
  vendorName: string | null;
  slotCode: string | null;
  aiExtractedLocation: string | null;
  assist: VendorReportAssist;
  reportType: VendorReportType;
  dueAt: string | null;
  isOverdue: boolean;
  vendorId: number | null;
  slotId: number | null;
  scannedPermitId: number | null;
  priceEvidence: ReportPriceEvidence | null;
  outcome: VendorReportOutcome | null;
  /** Context only: never a score, never a reason to act alone. */
  reportsAgainstVendor90Days: number;
  /** The type "Lập biên bản" pre-selects: rule-based, not AI. */
  suggestedViolationType: string | null;
  /** The biên bản raised from this report, if any. */
  violationId: number | null;
};

export type ResolveOutcome = 'DISMISSED' | 'MEDIATED';

export type WardReportFilter = {
  status?: WardReportStatus;
  type?: VendorReportType;
  /** true: only pending reports past their due time. */
  overdue?: boolean;
};

/** GET /ward/vendor-reports returns this many rows a page. */
export const WARD_REPORTS_PAGE_SIZE = 20;

export const wardReportsApi = {
  /** Overdue first, then nearest due time, then the closed ones (the server's order). */
  list: (filter: WardReportFilter, page = 1) =>
    apiGet<WardVendorReportSummary[]>(
      `/ward/vendor-reports?${new URLSearchParams({
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.overdue ? { overdue: 'true' } : {}),
        page: String(page),
      })}`,
    ),
  get: (reportId: number) => apiGet<WardVendorReport>(`/ward/vendor-reports/${reportId}`),
  /** [AI] Reads the photo again; rate limited because it calls the model. Never changes the report's state. */
  assist: (reportId: number) =>
    apiPost<WardVendorReport>(`/ward/vendor-reports/${reportId}/assist`, {}, { timeout: 45_000 }),
  /** 409 when the report is no longer `expectedStatus` (another officer closed it first). */
  resolve: (
    reportId: number,
    request: { expectedStatus: WardReportStatus; outcome: ResolveOutcome; note: string; refundAmount?: number },
  ) => apiPost<WardVendorReport>(`/ward/vendor-reports/${reportId}/resolve`, request),
};

export const wardReportKeys = {
  all: ['ward', 'vendor-reports'] as const,
  list: (filter: WardReportFilter) => ['ward', 'vendor-reports', 'list', filter] as const,
  detail: (reportId: number) => ['ward', 'vendor-reports', 'detail', reportId] as const,
};

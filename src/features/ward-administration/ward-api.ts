import { appendFile, type PickedFile } from '@/core/api/upload';
import { downloadToCache } from '@/core/api/client';
import { apiGet, apiGetBlob, apiPost, apiPut, apiUpload } from '@/core/api';
import type { PlacementIssue } from './ward-config-api';

// Business-registration review ("registrations") is NOT a CaseKind: it goes through
// WardComplianceController's dedicated /ward/enrollments endpoints below (complianceApi),
// which enforce the BR-41 identity-verification gate. See RegistrationReviewScreen.
export type CaseKind = 'proposals' | 'conflicts' | 'transfers';
export const wardReviewRoot = '/ward/inbox/reviews';
export type GeoPoint = { latitude: number; longitude: number };
export type GeoResult = { inside: boolean; wardId: number; boundaryVersion: string };
export type WardCase = {
  id: string;
  kind: CaseKind;
  title: string;
  status: string;
  slotCode: string;
  applicant: string;
  summary: string;
  location: GeoPoint | null;
  evidenceUrl: string | null;
  createdAt: string;
  reason: string | null;
  blockers: string[];
  actions: string[];
  queuePosition: number | null;
  contractTerm: string | null;
  outstanding: number | null;
  /** REG-02 documents attached to a registration case; empty for slot cases. */
  documents: WardDocument[] | null;
  /** REG-06: flagged for expedited handling. */
  fastTrack: boolean;
};
export type WardDocument = {
  evidenceType: string;
  fileUrl: string;
  uploadedAt: string;
};
export type WardProfile = {
  userId: string;
  wardId: number;
  name: string;
  /** Null unless this officer may sign a WARD-13 sanction decision (Chairman/Vice-Chairman, or a written delegate). */
  sanctionAuthorityTitle: string | null;
};
export type CasePage = { items: WardCase[]; page: number; hasMore: boolean };

/**
 * Ward endpoints go through the app's shared axios client, so a signed-in ward
 * officer's ordinary session is the only credential involved. They used to run on
 * a private fetch client with its own token in sessionStorage, which meant an
 * officer had to paste a JWT by hand before they could review anything.
 *
 * What that buys us, for free: the bearer is attached by the request interceptor,
 * an expired access token is refreshed once and the call retried, a revoked
 * session clears the app session and redirects to sign-in, and every failure
 * arrives as an `ApiError` carrying the backend's own Vietnamese message
 * (`code: 'conflict'` for the 409 stale-status case the reviewer sees). complianceApi
 * below (WARD-04/05/06, 11..13) was migrated onto the same client for the same reason --
 * it used to share the old private fetch client and the same paste-a-JWT problem.
 */
export const wardApi = {
  me: () => apiGet<WardProfile>('/ward/me'),
  list: (kind: CaseKind, page: number) => apiGet<CasePage>(`/ward/cases/${kind}?page=${page}`),
  get: (kind: CaseKind, id: string) =>
    apiGet<WardCase>(`/ward/cases/${kind}/${encodeURIComponent(id)}`),
  decide: (record: WardCase, decision: string, reason: string) =>
    apiPost<WardCase>(`/ward/cases/${record.kind}/${record.id}/decision`, {
      decision,
      reason,
      expectedStatus: record.status,
    }),
  search: (address: string) =>
    apiGet<{ label: string; point: GeoPoint }[]>(
      `/ward/geo/search?address=${encodeURIComponent(address)}`,
    ),
  verify: (point: GeoPoint) => apiPost<GeoResult>('/ward/geo/verify', point),
  pin: (id: string, point: GeoPoint) =>
    apiPut<WardCase>(`/ward/cases/proposals/${id}/location`, point),

  /** AIC-04: the latest logged assessment, if any -- never calls the AI provider itself. */
  proposalAssessment: (id: string) =>
    apiGet<AiProposalAssessmentView>(`/ward/cases/proposals/${id}/ai-assessment`),
  /** AIC-04: officer explicitly asks for a fresh (or reused, if nothing changed) assessment. */
  runProposalAssessment: (id: string) =>
    apiPost<AiProposalAssessment>(`/ward/cases/proposals/${id}/ai-assessment`, {}),

  /**
   * Evidence files require the bearer token (PRI-02), so they are fetched as a blob
   * rather than linked. `fileUrl` is origin-relative and already starts with /api,
   * which the client's baseURL also ends in - hence apiPathFromFileUrl.
   */
  document: (fileUrl: string): Promise<string> => downloadToCache(fileUrl),
};

export function parsePoint(latitude: string, longitude: string): GeoPoint | null {
  if (!latitude.trim() || !longitude.trim()) return null;
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  return Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
    ? point
    : null;
}

// ---- Ward Review, Permit & Compliance (WARD-04..08, 11..13) ----

export type WardEvidence = { evidenceId: number; type: string; label: string; fileUrl: string };
export type AiDocumentCheck = {
  matchPercentage: number;
  isMatch: boolean;
  needsManualVerification: boolean;
  summary: string;
  discrepancies: string[];
  isAiGenerated: boolean;
  /** Set only when isAiGenerated -- BR-41's log row, for AiSuggestionCard's accept/reject. */
  aiLogId?: number | null;
};
export type WardEnrollmentItem = {
  id: string;
  displayName: string;
  ownerName: string;
  idNumber: string | null;
  vendorType: string;
  status: string;
  address: string;
  createdAt: string;
  fastTrack: boolean;
  /** The real vendor_id a violation record (recordViolation's vendorId) must use -- not `id`
   * above, which is the registration id. */
  vendorId: number;
};
/** Mẫu số 01 Phụ lục II, Thông tư 68/2025/TT-BTC -- chủ hộ kinh doanh. */
export type WardOwnerProfile = {
  dateOfBirth: string | null;
  gender: string | null;
  ethnicity: string | null;
  nationality: string | null;
  idType: string | null;
  idIssuedDate: string | null;
  idIssuedPlace: string | null;
  permanentAddress: string | null;
  contactAddress: string | null;
};
export type WardBusinessProfile = {
  businessLine: string | null;
  businessLineCode: string | null;
  capitalAmount: number | null;
  laborCount: number | null;
  plannedStartDate: string | null;
};
export type WardHouseholdMember = {
  fullName: string;
  dateOfBirth: string | null;
  idNumber: string | null;
  relationshipToOwner: string | null;
  capitalContribution: number | null;
};
/** A server-recorded eKYC check. Scores are written where they are computed, never sent by
 * the applicant's browser, so a client cannot claim a similarity it did not get. */
export type WardKycCheck = {
  checkType: 'ID_CARD_OCR' | 'FACE_MATCH';
  provider: string;
  isMatch: boolean | null;
  similarityPercent: number | null;
  confidencePercent: number | null;
  warnings: string | null;
  createdAt: string;
};
export type WardEnrollmentDetail = WardEnrollmentItem & {
  latitude: number | null;
  longitude: number | null;
  reviewReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  evidence: WardEvidence[];
  aiCheck: AiDocumentCheck | null;
  ownerProfile: WardOwnerProfile;
  businessProfile: WardBusinessProfile;
  foodSafetyCommitmentAt: string | null;
  householdMembers: WardHouseholdMember[];
  /** BR-41 KYC gate: true only after an officer called confirmIdentity -- AI-OCR alone never
   * sets this, since it only reads/self-compares a photo and never queries the national
   * population database. decideEnrollment's APPROVE is refused server-side until this is true. */
  identityVerified: boolean;
  identityVerifiedAt: string | null;
  identityVerifiedByName: string | null;
  identityVerificationNote: string | null;
  /** X01: drafted by the voice assistant and accepted by the vendor before filing. A label only
   * -- the review is the same. Absent from servers older than the voice assistant. */
  assistedByAi?: boolean;
  kycChecks: WardKycCheck[];
};

export type WardRentalApplicationItem = {
  id: string;
  applicationMethod: string;
  requestedTermDays: number;
  status: string;
  vendorName: string;
  slotCode: string;
  slotStreet: string;
  pricePerDay: number;
  createdAt: string;
};
export type WardRentalApplicationDetail = WardRentalApplicationItem & {
  registrationId: number;
  registrationStatus: string;
  vendorPhone: string;
  slotId: number;
  slotWidth: number;
  slotLength: number;
  reviewReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  canApprove: boolean;
  blockers: string[];
  /** What approving it bills, from the same quote the vendor applied against (absent from an
   * older server). rentFee is after any quarterly discount; deposit is refundable. */
  totalFee?: number;
  rentFee?: number;
  deposit?: number;
};

export type AiEncroachment = {
  detectedEncroachment: boolean;
  encroachmentDistanceCm: number;
  analysis: string;
  visualCues: string[];
  isAiGenerated: boolean;
  aiLogId?: number | null;
};
export type InspectPermitResult = {
  found: boolean;
  isValid: boolean;
  effectiveStatus: string;
  permitId: number | null;
  contractId: number | null;
  vendorId: number | null;
  vendorName: string | null;
  slotId: number | null;
  slotCode: string | null;
  slotStreet: string | null;
  width: number | null;
  length: number | null;
  startDate: string | null;
  endDate: string | null;
  distanceMeters: number | null;
  isLocationMatched: boolean;
  locationWarning: string | null;
  aiVisionResult: AiEncroachment | null;
  /** False when the slot belongs to another ward: the permit's validity is shown, but the ids
   * to act on are withheld and acting on it is that ward's job (absent from an older server). */
  isOwnWard?: boolean;
};

export type PenaltyScheduleItem = {
  scheduleId: number;
  violationType: string;
  violationTypeName: string;
  penaltyAmount: number;
  legalBasis: string | null;
};
/** Fields mirror Mau MBB01 (Nghi dinh 118/2021/NĐ-CP). legalBasis is always copied verbatim
 * from the ward's own PenaltyFeeSchedules row on the backend -- never AI-authored text. */
export type AiLegalSuggestion = {
  violationType: string;
  penaltyScheduleId: number | null;
  legalBasis: string | null;
  suggestedPenaltyAmount: number | null;
  hanhViViPham: string;
  bienPhapKhacPhuc: string;
  isAiGenerated: boolean;
  aiLogId?: number | null;
};
export type WardViolationItem = {
  violationId: number;
  contractId: number | null;
  slotCode: string | null;
  vendorName: string | null;
  violationType: string;
  violationTypeName: string;
  status: string;
  penaltyAmount: number | null;
  recordedAt: string;
  recordedByName: string;
};
export type WardViolationDetail = WardViolationItem & {
  slotId: number | null;
  vendorId: number | null;
  description: string | null;
  evidenceUrl: string | null;
  sanctionDecisionNumber: string | null;
  signerName: string | null;
  signerTitle: string | null;
  sanctionedAt: string | null;
  recentViolationCount90Days: number;
  aiSuggestion: AiLegalSuggestion | null;
  // Mẫu số 01 (Nghị định 118/2021/NĐ-CP) fields -- WARD-12 legal-completeness.
  bienBanSo: string | null;
  preparedLocation: string | null;
  witnessName: string | null;
  witnessRole: string | null;
  witnessOccupation: string | null;
  witnessAddress: string | null;
  containmentMeasures: string | null;
  violatorFullName: string | null;
  violatorDateOfBirth: string | null;
  violatorGender: string | null;
  violatorNationality: string | null;
  violatorIdNumber: string | null;
  violatorIdIssuedDate: string | null;
  violatorIdIssuedPlace: string | null;
  violatorAddress: string | null;
  /** Điều 61 Luật XLVPHC: violator's right to giải trình before a sanction may issue. */
  explanationRequired: boolean;
  explanationMethod: string | null;
  explanationDeadlineAt: string | null;
  explanationReceivedAt: string | null;
  explanationContent: string | null;
  deliveredAt: string | null;
  deliveredToName: string | null;
  deliveryRefused: boolean;
  deliveryRefusalReason: string | null;
  complianceFlag: WardComplianceFlag;
};

/** Advisory only -- never blocks or auto-triggers anything (BR-41). Null thresholds mean the
 * ward has not configured that part of the policy. */
export type WardComplianceFlag = {
  violationThreshold: number | null;
  sanctionedViolationCount: number;
  violationThresholdReached: boolean;
  unpaidPenaltyGraceDays: number | null;
  hasOverduePenalty: boolean;
  overduePenaltyDays: number | null;
};

export type WardRiskQueueItem = {
  registrationId: string;
  displayName: string;
  score: number;
  breakdown: { reason: string; points: number }[];
};
export type WardPatrolHeatmapPoint = {
  zoneId: number | null;
  zoneName: string | null;
  dayOfWeek: number;
  hourOfDay: number;
  violationCount: number;
};

/** BR-41: the officer's accept/reject of a previously-logged AI suggestion (AiAssistanceLogs). */
export type AiSuggestionFeedback = {
  aiLogId: number;
  accepted: boolean;
  reviewedAt: string;
  reviewerName: string;
};

// -- AIC-04: proposed-slot feasibility --
export type AiProposalAssessment = {
  estimatedSidewalkWidthMeters: number | null;
  remainingPedestrianWidthMeters: number | null;
  obstructionLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  recommendation: 'LIKELY_FEASIBLE' | 'NEEDS_SURVEY' | 'LIKELY_INFEASIBLE';
  confidence: number;
  reasons: string[];
  ruleChecks: PlacementIssue[];
  usedSatelliteImage: boolean;
  usedProposalPhoto: boolean;
  isAiGenerated: boolean;
  assessedAt: string | null;
  aiLogId: number | null;
};
export type AiProposalAssessmentView = { latest: AiProposalAssessment | null; isStale: boolean };

// -- AIC-06: geofence drift --
export type GeofenceDriftScan = {
  scanId: number;
  scannedAt: string;
  scanContext: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
};
export type GeofenceDriftItem = {
  permitId: number;
  contractId: number;
  slotId: number;
  slotCode: string;
  zoneName: string | null;
  vendorName: string;
  scanCount: number;
  offSiteCount: number;
  maxDistanceMeters: number;
  meanOffsetMeters: number | null;
  meanOffsetBearingDegrees: number | null;
  level: 'WATCH' | 'DRIFT';
  pattern: 'CONSISTENT_DIRECTION' | 'SCATTERED';
  lastOffSiteAt: string;
  scans: GeofenceDriftScan[];
  explanation: string;
  isAiGenerated: boolean;
  aiLogId: number | null;
};
export type GeofenceDriftReport = {
  windowDays: number;
  toleranceMeters: number;
  items: GeofenceDriftItem[];
};

// -- Renewal Review (WARD-09) --
export type WardRenewalItem = {
  id: string;
  contractId: number;
  slotCode: string;
  slotStreet: string;
  vendorName: string;
  status: string;
  requestedTermDays: number;
  currentEndDate: string;
  proposedEndDate: string;
  pricePerDay: number;
  totalFee: number;
  isFastTrackEligible: boolean;
  violationCount: number;
  createdAt: string;
  /** NĐ 241/2026 Điều 21: hạn xử lý 3 ngày làm việc, tính gần đúng bằng ngày lịch. */
  slaDueAt: string;
  isOverdue: boolean;
};
export type WardVendorComplianceScorecard = {
  totalInspections: number;
  violationCount: number;
  unpaidPenaltyCount: number;
  totalPenaltyAmount: number;
  reportCount: number;
  currentPermitStatus: string;
  isCleanRecord: boolean;
};
/** Idea 4 (WARD-09): batch fast-approval for the Fast-track filtered renewal queue. Each item
 * runs through the exact same precondition checks as a single decision -- a batch call never
 * skips a check a single approval would run, it just lets an officer fire many at once. */
export type WardRenewalBatchDecisionItemResult = {
  renewalId: number;
  success: boolean;
  errorMessage: string | null;
  newEndDate: string | null;
};
export type WardRenewalBatchDecisionResult = {
  totalRequested: number;
  successCount: number;
  failureCount: number;
  results: WardRenewalBatchDecisionItemResult[];
};
export type WardRenewalDetail = WardRenewalItem & {
  requestedTermDays: number;
  currentEndDate: string;
  proposedEndDate: string;
  remainingDaysOnCurrentContract: number;
  slotId: number;
  slotWidth: number;
  slotLength: number;
  pricePerDay: number;
  totalEstimatedFee: number;
  vendorId: number;
  vendorPhone: string;
  vendorType: string;
  registrationId: number;
  registrationStatus: string;
  reviewReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  canApprove: boolean;
  isFastTrackEligible: boolean;
  blockers: string[];
  scorecard: WardVendorComplianceScorecard;
};

export const complianceApi = {
  listEnrollments: (status?: string, page = 1) =>
    apiGet<WardEnrollmentItem[]>(
      `/ward/enrollments?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`,
    ),
  getEnrollment: (id: string) => apiGet<WardEnrollmentDetail>(`/ward/enrollments/${id}`),
  /** The action word the API validates (WardComplianceUseCases), not the resulting status. */
  decideEnrollment: (id: string, decision: 'APPROVE' | 'REJECT' | 'MORE_INFO', reason: string, expectedStatus: string) =>
    apiPost<WardEnrollmentDetail>(`/ward/enrollments/${id}/decision`, {
      decision,
      reason,
      expectedStatus,
    }),
  /** BR-41 KYC gate: officer confirms they compared the vendor against their physical/chip
   * CCCD. The backend refuses decideEnrollment's APPROVE until this has been called. */
  confirmIdentity: (id: string, note: string) =>
    apiPost<WardEnrollmentDetail>(`/ward/enrollments/${id}/confirm-identity`, { note }),
  /** Mẫu số 01 Phụ lục II, TT 68/2025/TT-BTC -- same content as the vendor's own copy, plus the
   * reviewing officer's name once approved. Watermarked "BẢN NHÁP" until then. */
  downloadEnrollmentDocument: (id: string, format: 'docx' | 'pdf'): Promise<Blob> =>
    apiGetBlob(`/ward/enrollments/${id}/document?format=${format}`),

  listRentalApplications: (status?: string, page = 1) =>
    apiGet<WardRentalApplicationItem[]>(
      `/ward/rental-applications?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`,
    ),
  getRentalApplication: (id: string) =>
    apiGet<WardRentalApplicationDetail>(`/ward/rental-applications/${id}`),
  decideRentalApplication: (id: string, decision: string, reason: string, expectedStatus: string) =>
    apiPost<WardRentalApplicationDetail>(`/ward/rental-applications/${id}/decision`, {
      decision,
      reason,
      expectedStatus,
    }),

  // -- Renewal Applications (WARD-09) --
  listRenewals: (status?: string, page = 1) =>
    apiGet<WardRenewalItem[]>(
      `/ward/renewals?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`,
    ),
  getRenewal: (id: string) => apiGet<WardRenewalDetail>(`/ward/renewals/${id}`),
  decideRenewal: (id: string, decision: string, reason: string, expectedStatus: string) =>
    apiPost<WardRenewalDetail>(`/ward/renewals/${id}/decision`, {
      decision,
      reason,
      expectedStatus,
    }),
  /** Idea 4: batch-approve renewals an officer has selected from the Fast-track filtered queue. */
  batchDecideRenewals: (
    items: { renewalId: number; expectedStatus: string }[],
    decision: string,
    reason: string,
  ) =>
    apiPost<WardRenewalBatchDecisionResult>('/ward/renewals/batch-decision', {
      items: items.map((i) => ({ renewalId: i.renewalId, expectedStatus: i.expectedStatus })),
      decision,
      reason,
    }),

  inspectPermit: (
    permitCodeOrPayload: string,
    latitude?: number,
    longitude?: number,
    inspectionPhotoUrl?: string,
  ) =>
    apiPost<InspectPermitResult>('/ward/permits/inspect', {
      permitCodeOrPayload,
      latitude,
      longitude,
      inspectionPhotoUrl,
    }),
  permitAction: (
    permitId: number,
    action: 'SUSPEND' | 'REVOKE',
    reason: string,
    basedOnComplianceThreshold = false,
  ) =>
    apiPost<boolean>(`/ward/permits/${permitId}/action`, {
      action,
      reason,
      basedOnComplianceThreshold,
    }),

  /** Rates in force on `asOf` (yyyy-MM-dd, Vietnam date); default today. Sanctioning must use the violation date. */
  listPenaltySchedules: (asOf?: string) =>
    apiGet<PenaltyScheduleItem[]>(`/ward/penalty-schedules${asOf ? `?asOf=${asOf}` : ''}`),
  listViolations: (status?: string, page = 1) =>
    apiGet<WardViolationItem[]>(
      `/ward/violations?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`,
    ),
  getViolation: (id: number) => apiGet<WardViolationDetail>(`/ward/violations/${id}`),
  recordViolation: (request: {
    contractId?: number;
    slotId?: number;
    vendorId?: number;
    violationType: string;
    description: string;
    evidenceUrl?: string;
    preparedLocation?: string;
    witnessName?: string;
    witnessRole?: string;
    witnessOccupation?: string;
    witnessAddress?: string;
    containmentMeasures?: string;
    explanationRequired?: boolean;
    explanationMethod?: string;
    /** WARD-19: the citizen report this record is raised from. It must be PENDING, of this ward and
     * about the same vendor or slot; the report then closes (VIOLATION_RECORDED) in the same
     * transaction. One record per report. */
    sourceReportId?: number;
  }) => apiPost<WardViolationDetail>('/ward/violations', request),
  /** Điều 61 Luật XLVPHC: records the violator's giải trình before a sanction may issue. */
  recordExplanation: (id: number, content: string) =>
    apiPost<WardViolationDetail>(`/ward/violations/${id}/explanation`, { content }),
  /** Mẫu 01's handover block -- delivered or refused go together with their own reason. */
  deliverViolation: (
    id: number,
    deliveredToName: string | null,
    refused: boolean,
    refusalReason: string | null,
  ) =>
    apiPost<WardViolationDetail>(`/ward/violations/${id}/deliver`, {
      deliveredToName,
      refused,
      refusalReason,
    }),
  /** Mẫu biên bản số 01 (NĐ 118/2021/NĐ-CP), filled with this violation's data, as a .docx blob. */
  downloadViolationDocument: (id: number): Promise<Blob> =>
    apiGetBlob(`/ward/violations/${id}/document`),
  // Signer is never sent from here: the server takes it from the authenticated officer's own
  // account (UserAccounts.sanction_authority_title), never from client input.
  sanctionViolation: (
    id: number,
    penaltyScheduleId: number,
    decisionNumber: string,
    notes?: string,
    acknowledgeEarlySanction?: boolean,
    /** Only inside the legal bracket of the chosen rate, with a reason (checked server-side). */
    amountOverride?: { amount: number; reason: string },
  ) =>
    apiPost<WardViolationDetail>(`/ward/violations/${id}/sanction`, {
      penaltyScheduleId,
      decisionNumber,
      notes,
      acknowledgeEarlySanction,
      amountOverride: amountOverride?.amount,
      amountReason: amountOverride?.reason,
    }),

  riskQueue: () => apiGet<WardRiskQueueItem[]>('/ward/insights/risk-queue'),
  patrolHeatmap: () => apiGet<WardPatrolHeatmapPoint[]>('/ward/insights/patrol-heatmap'),

  /** Server-authoritative: loads this registration's own stored evidence + declared profile and
   * checks biometric consent server-side. Never send an evidence list / declared name-address
   * from the client -- an earlier draft did, and its shape drifted out of sync with the backend
   * (which only ever needed the registration id). */
  // The server allows the AI check up to 30 s (a hung model, then its fallback).
  aiDocumentExtract: (registrationId: string) =>
    apiPost<AiDocumentCheck>(
      '/ward/ai/document-extract',
      { registrationId: Number(registrationId) },
      { timeout: 45_000 },
    ),

  aiEncroachmentCheck: (
    photoUrl: string,
    slotWidth?: number,
    slotLength?: number,
    slotId?: number,
  ) =>
    apiPost<AiEncroachment>('/ward/ai/encroachment-check', {
      photoUrl,
      slotWidth,
      slotLength,
      slotId,
    }),

  /** BR-41: accept or reject a previously-logged AI suggestion. Never the same action as
   * approving/saving whatever the suggestion was about. */
  aiFeedback: (aiLogId: number, accepted: boolean, note?: string) =>
    apiPost<AiSuggestionFeedback>(`/ward/ai/suggestions/${aiLogId}/feedback`, { accepted, note }),

  /** AIC-06: permits whose QR scans repeatedly land away from their licensed slot. */
  geofenceDrift: () => apiGet<GeofenceDriftReport>('/ward/insights/geofence-drift'),

  /** Shared with REG-02; UploadsController also authorizes WARD_AUTHORITY for WARD-11/12 evidence. */
  uploadEvidence: (file: PickedFile): Promise<{ fileUrl: string }> => {
    const form = new FormData();
    appendFile(form, file);
    return apiUpload<{ fileUrl: string }>('/uploads/evidence', form);
  },
};

export const violationTypeLabels: Record<string, string> = {
  UNAUTHORIZED_BUSINESS_USE: 'Sử dụng trái phép vỉa hè để kinh doanh',
  EXPIRED_OR_INVALID_PERMIT: 'Giấy phép hết hạn / sai nội dung',
  STREET_VENDING_RESTRICTED: 'Bán hàng rong tại tuyến phố cấm',
  HYGIENE_LITTERING: 'Vứt rác, mất vệ sinh vỉa hè',
  OBSTRUCT_PUBLIC_ORDER: 'Cản trở an ninh trật tự công cộng',
  PRICE_NOT_POSTED: 'Không niêm yết giá',
  PRICE_ABOVE_POSTED: 'Bán cao hơn giá niêm yết',
};

export const caseLabels: Record<CaseKind, string> = {
  proposals: 'Đề xuất vị trí',
  conflicts: 'Xung đột địa chỉ',
  transfers: 'Chuyển nhượng ô',
};
export const actionLabels: Record<string, string> = {
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  QUEUE: 'Đưa vào hàng chờ',
  REVIEW: 'Nhận xét duyệt',
  REQUEST_INFO: 'Yêu cầu bổ sung',
};
export const statusLabels: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  SUBMITTED: 'Chờ xét duyệt',
  UNDER_REVIEW: 'Đang xét duyệt',
  MORE_INFORMATION_REQUIRED: 'Chờ bổ sung giấy tờ',
  ACCEPTED_BY_RECEIVER: 'Bên nhận đã đồng ý',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  WITHDRAWN: 'Đã rút',
};

/**
 * UNDER_REVIEW means "under review" for a registration but "queued for the slot"
 * for an address conflict, so the label depends on the case kind.
 */
export function statusLabel(kind: CaseKind, status: string): string {
  if (kind === 'conflicts' && status === 'UNDER_REVIEW') return 'Đang xếp hàng';
  return statusLabels[status] ?? status;
}

export const evidenceLabels: Record<string, string> = {
  IDENTITY_DOCUMENT: 'CCCD gắn chip',
  IDENTITY_DOCUMENT_BACK: 'CCCD mặt sau',
  PORTRAIT_SELFIE: 'Ảnh chân dung',
  BUSINESS_LICENSE: 'Giấy phép kinh doanh',
  ADDRESS_PROOF: 'Giấy tờ địa chỉ',
  OTHER: 'Giấy tờ khác',
};

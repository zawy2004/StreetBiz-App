import { apiGet, apiPost } from './client';

/** Ward officer on patrol (WARD-07…13): StreetBiz-BE `WardComplianceController`. */

export type InspectResult = {
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
};

export type PenaltySchedule = { scheduleId: number; violationType: string; violationTypeName: string; penaltyAmount: number; legalBasis: string | null };

export type WardViolation = { violationId: number; status: string; penaltyAmount: number | null; vendorName: string | null; violationTypeName: string };

export const wardApi = {
  /** Checks a scanned permit (signed payload or printed code) and, with GPS, whether the stall is on its slot. */
  inspect: (permitCodeOrPayload: string, at?: { latitude: number; longitude: number }) =>
    apiPost<InspectResult>('/ward/permits/inspect', { permitCodeOrPayload, latitude: at?.latitude ?? null, longitude: at?.longitude ?? null, inspectionPhotoUrl: null }),
  permitAction: (permitId: number, action: 'SUSPEND' | 'REVOKE', reason: string) =>
    apiPost<boolean>(`/ward/permits/${permitId}/action`, { action, reason, basedOnComplianceThreshold: false }),
  penaltySchedules: () => apiGet<PenaltySchedule[]>('/ward/penalty-schedules'),
  recordViolation: (input: { contractId: number | null; slotId: number | null; vendorId: number | null; violationType: string; description: string; evidenceUrl: string | null }) =>
    apiPost<WardViolation>('/ward/violations', input),
  sanction: (violationId: number, penaltyScheduleId: number, decisionNumber: string, notes: string | null) =>
    apiPost<WardViolation>(`/ward/violations/${violationId}/sanction`, { penaltyScheduleId, decisionNumber, notes, acknowledgeEarlySanction: false }),
};

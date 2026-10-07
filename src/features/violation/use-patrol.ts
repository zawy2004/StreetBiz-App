import { communityApi } from '@/core/api/community-api';
import { useDualMutation, useDualQuery } from '@/core/api/dual';
import { ApiError } from '@/core/api/problem';
import { wardApi } from '@/core/api/ward-api';
import { useMockDb } from '@/mocks/db';
import { daysUntil } from '@/utils/format';
import { distanceMeters } from '@/utils/geo';

export type Inspection = {
  found: boolean;
  valid: boolean;
  status: string;
  permitId?: string;
  contractId?: string;
  vendorId?: string;
  vendorName?: string;
  slotId?: string;
  slotLabel?: string;
  validUntil?: string;
  /** Metres between the officer and the permitted slot, when GPS was available. */
  offsetM?: number;
  locationOk?: boolean;
  locationWarning?: string;
};

/** WARD-07: inspect a scanned permit; with a GPS fix the backend also checks the stall is on its slot. */
export function useInspectPermit(code: string | undefined, at: { latitude: number; longitude: number } | undefined) {
  const db = useMockDb();
  const permit = db.permits.find((p) => p.permit_code.toLowerCase() === (code ?? '').toLowerCase());
  const contract = db.contracts.find((c) => c.id === permit?.contractId);
  const vendor = db.vendors.find((v) => v.id === contract?.vendorId);
  const slot = db.slots.find((s) => s.id === contract?.slotId);
  const offset = at && slot ? distanceMeters({ lat: at.latitude, lng: at.longitude }, slot) : undefined;
  const mock: Inspection = {
    found: Boolean(permit && vendor && contract),
    valid: Boolean(permit && permit.permit_status === 'VALID' && daysUntil(permit.expires_at) >= 0),
    status: permit ? (permit.permit_status === 'VALID' && daysUntil(permit.expires_at) < 0 ? 'EXPIRED' : permit.permit_status) : 'NOT_FOUND',
    permitId: permit?.id,
    contractId: contract?.id,
    vendorId: vendor?.id,
    vendorName: vendor ? vendor.business_name || vendor.owner_name : undefined,
    slotId: slot?.id,
    slotLabel: slot ? `${slot.slot_code} · ${slot.size_m2} m²` : undefined,
    validUntil: permit?.expires_at,
    offsetM: offset,
    locationOk: offset === undefined ? undefined : offset <= 25,
  };

  return useDualQuery({
    key: ['ward', 'inspect', code, at?.latitude, at?.longitude],
    live: async (): Promise<Inspection> => {
      const r = await wardApi.inspect(code!, at);
      const size = r.width && r.length ? ` · ${r.width} × ${r.length} m` : '';
      return {
        found: r.found,
        valid: r.isValid,
        status: r.effectiveStatus,
        permitId: r.permitId !== null ? String(r.permitId) : undefined,
        contractId: r.contractId !== null ? String(r.contractId) : undefined,
        vendorId: r.vendorId !== null ? String(r.vendorId) : undefined,
        vendorName: r.vendorName ?? undefined,
        slotId: r.slotId !== null ? String(r.slotId) : undefined,
        slotLabel: r.slotCode ? `${r.slotCode}${r.slotStreet ? ` · ${r.slotStreet}` : ''}${size}` : undefined,
        validUntil: r.endDate ?? undefined,
        offsetM: r.distanceMeters !== null ? Math.round(r.distanceMeters) : undefined,
        locationOk: r.distanceMeters !== null ? r.isLocationMatched : undefined,
        locationWarning: r.locationWarning ?? undefined,
      };
    },
    mock,
    enabled: Boolean(code),
  });
}

export type ViolationKind = { code: string; label: string; amount: number; scheduleId?: number };

/** The ward's penalty schedule: one row per violation type, with its fine. */
export function useViolationKinds() {
  const mock = useMockDb((s) => s.violationTypes).map((t): ViolationKind => ({ code: t.code, label: t.label, amount: t.default_amount }));
  return useDualQuery({
    key: ['ward', 'penalty-schedules'],
    live: async () =>
      (await wardApi.penaltySchedules()).map((s): ViolationKind => ({ code: s.violationType, label: s.violationTypeName, amount: s.penaltyAmount, scheduleId: s.scheduleId })),
    mock,
  });
}

/**
 * WARD-09…11: record the violation (with the first photo as evidence) and
 * issue the sanction decision. Live, a recorded violation that needs the
 * vendor's explanation first stays recorded even if the sanction is refused.
 */
export function useIssueViolation() {
  return useDualMutation<
    { vendorId?: string; contractId?: string; slotId?: string; kind: ViolationKind; note: string; photos: string[]; decisionNumber: string; amount: number },
    { sanctioned: boolean; message?: string }
  >({
    live: async ({ vendorId, contractId, slotId, kind, note, photos, decisionNumber }) => {
      const evidenceUrl = photos[0] ? (await communityApi.uploadEvidence(photos[0])).fileUrl : null;
      const violation = await wardApi.recordViolation({
        contractId: contractId ? Number(contractId) : null,
        slotId: slotId ? Number(slotId) : null,
        vendorId: vendorId ? Number(vendorId) : null,
        violationType: kind.code,
        description: note || kind.label,
        evidenceUrl,
      });
      if (!kind.scheduleId) return { sanctioned: false, message: 'Đã lập biên bản; chưa có khung phạt để ra quyết định.' };
      try {
        await wardApi.sanction(violation.violationId, kind.scheduleId, decisionNumber, note || null);
        return { sanctioned: true };
      } catch (e) {
        return { sanctioned: false, message: e instanceof ApiError ? e.message : 'Đã lập biên bản; quyết định xử phạt chưa ban hành được.' };
      }
    },
    mock: ({ vendorId, slotId, kind, note, photos, amount }) => {
      if (!vendorId) throw new ApiError('validation_error', 400, 'Thiếu hộ kinh doanh');
      useMockDb.getState().recordViolation(
        { vendorId, slotId: slotId || undefined, violation_type: kind.code, note: [kind.label, note].filter(Boolean).join('. '), photoUris: photos, reportedBy: 'WARD' },
        amount,
      );
      return { sanctioned: true };
    },
    invalidate: [['ward']],
  });
}

/** WARD-12/13: suspend or revoke a permit on the spot. */
export function usePermitAction() {
  return useDualMutation<{ permitId: string; action: 'suspend' | 'revoke'; reason: string }, void>({
    live: async ({ permitId, action, reason }) => void (await wardApi.permitAction(Number(permitId), action === 'suspend' ? 'SUSPEND' : 'REVOKE', reason)),
    mock: ({ permitId, action }) => (action === 'suspend' ? useMockDb.getState().suspendPermit(permitId) : useMockDb.getState().revokePermit(permitId)),
    invalidate: [['ward']],
  });
}

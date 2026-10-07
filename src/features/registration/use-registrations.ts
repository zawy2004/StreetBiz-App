import { apiPut } from '@/core/api/client';
import { useDualMutation, useDualQuery } from '@/core/api/dual';
import { registrationApi, slotsApi, type ApiEvidenceType, type ApiRegistration, type RegistrationPayload } from '@/core/api/vendor-api';
import { useMockDb } from '@/mocks/db';
import type { VendorType } from '@/mocks/types';
import { useAuthStore } from '@/store/auth-store';
import { parseDate } from '@/utils/format';

import { EVIDENCE_LABELS, requiredEvidence, type EvidenceKind } from './registration-draft';

/** How the app's evidence slots map onto RegistrationEvidence.evidence_type. */
const EVIDENCE_TYPE: Record<EvidenceKind, ApiEvidenceType> = {
  ID_FRONT: 'IDENTITY_DOCUMENT',
  ID_BACK: 'IDENTITY_DOCUMENT_BACK',
  BUSINESS_LICENSE: 'BUSINESS_LICENSE',
  SCENE_PHOTO: 'ADDRESS_PROOF',
};

const KIND_OF: Partial<Record<ApiEvidenceType, EvidenceKind>> = Object.fromEntries(
  Object.entries(EVIDENCE_TYPE).map(([kind, type]) => [type, kind as EvidenceKind]),
);

const API_EVIDENCE_LABEL: Record<ApiEvidenceType, string> = {
  IDENTITY_DOCUMENT: 'CCCD mặt trước',
  IDENTITY_DOCUMENT_BACK: 'CCCD mặt sau',
  PORTRAIT_SELFIE: 'Ảnh chân dung',
  BUSINESS_LICENSE: 'Giấy phép kinh doanh',
  ADDRESS_PROOF: 'Ảnh / giấy tờ nơi bán hàng',
  OTHER: 'Giấy tờ khác',
};

export type RegistrationView = {
  id: string;
  vendorType: VendorType;
  name: string;
  address: string;
  status: string;
  submittedAt: string;
  reviewNote?: string;
  evidence: { kind?: EvidenceKind; label: string }[];
};

function fromApi(r: ApiRegistration, evidence: { evidenceType: ApiEvidenceType }[] = []): RegistrationView {
  return {
    id: String(r.registrationId),
    vendorType: r.vendorType,
    name: r.displayName,
    address: r.declaredAddress ?? '',
    status: r.registrationStatus,
    submittedAt: r.createdAt,
    reviewNote: r.reviewDecisionReason ?? undefined,
    evidence: evidence.map((e) => ({ kind: KIND_OF[e.evidenceType], label: API_EVIDENCE_LABEL[e.evidenceType] })),
  };
}

/** REG-03 */
export function useRegistrations() {
  const user = useAuthStore((s) => s.user);
  const mock = useMockDb((s) => s.registrations)
    .filter((r) => r.vendorId === user?.vendorId)
    .map(
      (r): RegistrationView => ({
        id: r.id,
        vendorType: r.vendor_type,
        name: r.business_name || r.owner_name,
        address: r.address,
        status: r.registration_status,
        submittedAt: r.submitted_at,
        reviewNote: r.review_note,
        evidence: r.evidence.map((e) => ({ kind: e.type as EvidenceKind, label: e.label })),
      }),
    );
  return useDualQuery({
    key: ['vendor', user?.id, 'registrations'],
    live: async () => (await registrationApi.list()).map((r) => fromApi(r)),
    mock,
  });
}

export function useRegistration(id: string | undefined) {
  const list = useRegistrations();
  return useDualQuery({
    key: ['vendor', 'registration', id],
    live: async () => {
      const d = await registrationApi.get(id!);
      return fromApi(d.registration, d.evidence);
    },
    mock: list.data?.find((r) => r.id === id) ?? null,
    enabled: Boolean(id),
  });
}

export type RegistrationInput = {
  vendorType: VendorType;
  businessName: string;
  category: string;
  address: string;
  wardUnitId?: number;
  ownerName: string;
  idNumber: string;
  birthDate: string;
  evidence: Partial<Record<EvidenceKind, string>>;
};

/** RegistrationPayload fields, read back from GET to re-submit without changes. */
const PAYLOAD_KEYS = [
  'vendorType',
  'displayName',
  'declaredAddress',
  'addressLatitude',
  'addressLongitude',
  'wardUnitId',
  'ownerDateOfBirth',
  'ownerGender',
  'ownerEthnicity',
  'ownerNationality',
  'idType',
  'idIssuedDate',
  'idIssuedPlace',
  'permanentAddress',
  'contactAddress',
  'businessLine',
  'businessLineCode',
  'capitalAmount',
  'laborCount',
  'plannedStartDate',
] as const;

async function attachEvidence(registrationId: string | number, files: Partial<Record<EvidenceKind, string>>) {
  for (const [kind, uri] of Object.entries(files) as [EvidenceKind, string | undefined][]) {
    if (!uri) continue;
    const { fileUrl } = await registrationApi.uploadEvidence(uri);
    await registrationApi.addEvidence(registrationId, EVIDENCE_TYPE[kind], fileUrl);
  }
}

/** REG-01 + REG-02: submit the registration, then upload and attach each document. Resolves with its id. */
export function useSubmitRegistration() {
  return useDualMutation<RegistrationInput, string>({
    live: async (d) => {
      const user = useAuthStore.getState().user;
      const birth = parseDate(d.birthDate);
      const payload: RegistrationPayload = {
        vendorType: d.vendorType,
        displayName: d.businessName.trim(),
        declaredAddress: d.address.trim() || null,
        addressLatitude: null,
        addressLongitude: null,
        wardUnitId: d.wardUnitId ?? user?.wardUnitId ?? 0,
        ownerDateOfBirth: birth ? birth.format('YYYY-MM-DD') : null,
        ownerGender: null,
        ownerEthnicity: null,
        ownerNationality: 'Việt Nam',
        idType: 'CCCD',
        idIssuedDate: null,
        idIssuedPlace: null,
        permanentAddress: null,
        contactAddress: d.address.trim() || null,
        businessLine: d.category || null,
        businessLineCode: null,
        capitalAmount: null,
        laborCount: null,
        plannedStartDate: null,
        foodSafetyCommitment: true,
        householdMembers: [],
      };
      const created = await registrationApi.submit(payload);
      await attachEvidence(created.registrationId, d.evidence);
      return String(created.registrationId);
    },
    mock: (d) => {
      const vendorId = useAuthStore.getState().user?.vendorId;
      if (!vendorId) throw new Error('Chưa có hồ sơ hộ kinh doanh');
      const kinds = requiredEvidence(d.vendorType);
      const db = useMockDb.getState();
      const registration = db.submitRegistration({
        vendorId,
        vendor_type: d.vendorType,
        business_name: d.businessName.trim(),
        owner_name: d.ownerName.trim(),
        id_number: d.idNumber,
        address: d.address.trim(),
        ward_unit_type: 'WARD',
        fast_track: false,
        evidence: kinds.map((k) => ({ type: k, uri: d.evidence[k]!, label: EVIDENCE_LABELS[k] })),
      });
      useMockDb.setState((s) => ({
        vendors: s.vendors.map((v) => (v.id === vendorId ? { ...v, business_name: registration.business_name, vendor_type: registration.vendor_type, address: registration.address } : v)),
      }));
      return registration.id;
    },
    invalidate: [['vendor']],
  });
}

/** REG-02/04: add the requested documents and send the registration back for review. */
export function useSupplementEvidence(id: string) {
  return useDualMutation<Partial<Record<EvidenceKind, string>>, void>({
    live: async (files) => {
      await attachEvidence(id, files);
      // Updating an editable registration re-submits it; the fields are sent back unchanged.
      const raw = (await registrationApi.get(id)).registration as unknown as Record<string, unknown>;
      const payload = Object.fromEntries(PAYLOAD_KEYS.map((k) => [k, raw[k] ?? null]));
      await apiPut(`/vendor/registrations/${id}`, { ...payload, foodSafetyCommitment: true, householdMembers: raw.householdMembers ?? [] });
    },
    mock: (files) => {
      const db = useMockDb.getState();
      const reg = db.registrations.find((r) => r.id === id);
      if (!reg) return;
      const kinds = Object.keys(files) as EvidenceKind[];
      db.updateRegistration(id, {
        registration_status: 'UNDER_REVIEW',
        review_note: undefined,
        evidence: [...reg.evidence.filter((e) => !kinds.includes(e.type as EvidenceKind)), ...kinds.map((k) => ({ type: k, uri: files[k]!, label: EVIDENCE_LABELS[k] }))],
      });
    },
    invalidate: [['vendor']],
  });
}

/** REG-05 */
export function useWithdrawRegistration() {
  return useDualMutation<string, void>({
    live: async (id) => void (await registrationApi.withdraw(id)),
    mock: (id) => useMockDb.getState().withdrawRegistration(id),
    invalidate: [['vendor']],
  });
}

/** SIDE-09: ask to move the business to a new address (the ward reviews adjacent slots). */
export function useRequestAddressChange(registrationId: string) {
  return useDualMutation<string, void>({
    live: async (address) => void (await slotsApi.requestAddressChange(Number(registrationId), address)),
    mock: (address) => {
      const reg = useMockDb.getState().registrations.find((r) => r.id === registrationId);
      if (reg) useMockDb.getState().requestAddressChange({ vendorId: reg.vendorId, registrationId, new_address: address });
    },
    invalidate: [['vendor']],
  });
}

import { create } from 'zustand';

import type { PickedFile } from '@/core/api/upload';

import {
  EVIDENCE_ACCEPTED_TYPES,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_TYPE,
  VENDOR_TYPE,
  type ApiEvidenceType,
  type ApiHouseholdMember,
  type ApiOwnerGender,
  type ApiOwnerIdType,
  type ApiVendorType,
} from '@/core/api';

/** One picked document, held locally until it is uploaded and attached (REG-02). */
export type DraftEvidence = {
  evidenceType: ApiEvidenceType;
  /** Object URL used for the preview only. */
  uri: string;
  label: string;
  /** The picked file; absent in mock mode seeds. */
  file?: PickedFile;
  /** URL returned by POST /api/uploads/evidence once the file is stored. */
  uploadedUrl?: string;
  /** True once the URL has been attached to the registration. */
  attached?: boolean;
};

/** A draft household member row (Mẫu số 01's "Thành viên hộ gia đình cùng góp vốn"). */
export type DraftHouseholdMember = {
  fullName: string;
  dateOfBirth: string;
  idNumber: string;
  relationshipToOwner: string;
  capitalContribution: string;
};

/**
 * REG-01/REG-02 wizard state. Field names follow the backend's
 * SubmitRegistrationRequest so the submit step is a direct mapping.
 *
 * The owner-identity/business fields mirror Mẫu số 01 Phụ lục II, Thông tư 68/2025/TT-BTC
 * (Giấy đề nghị đăng ký hộ kinh doanh, effective 01/07/2025) -- this wizard is what stands in
 * for that real government form inside StreetBiz, so it collects the same fields rather than
 * only what the ward sidewalk-use check needs.
 */
type Draft = {
  /** Set when the wizard is editing an existing registration (REG-04). */
  registrationId: number | null;
  /**
   * Id of the registration this wizard already created. Submitting is several
   * requests (upload, create, attach), so a retry after a partial failure must
   * resume instead of creating a second application.
   */
  createdRegistrationId: number | null;
  vendorType: ApiVendorType;
  displayName: string;
  declaredAddress: string;
  addressLatitude: number | null;
  addressLongitude: number | null;
  wardUnitId: number | null;
  evidence: DraftEvidence[];
  /** Separate, explicit consent to run AI-OCR on the ID photo later (Luat Bao ve du lieu ca
   * nhan 2025 / Nghi dinh 356/2025/ND-CP) -- unbundled from any other agreement checkbox. */
  biometricConsent: boolean;

  // ---- Chủ hộ kinh doanh ----
  ownerDateOfBirth: string;
  ownerGender: ApiOwnerGender | '';
  ownerEthnicity: string;
  ownerNationality: string;
  idType: ApiOwnerIdType | '';
  idIssuedDate: string;
  idIssuedPlace: string;
  permanentAddress: string;
  contactAddress: string;

  // ---- Ngành nghề, quy mô hộ kinh doanh ----
  businessLine: string;
  businessLineCode: string;
  capitalAmount: string;
  laborCount: string;
  plannedStartDate: string;

  // ---- Cam kết ATTP / thành viên hộ gia đình ----
  foodSafetyCommitment: boolean;
  householdMembers: DraftHouseholdMember[];
};

type NewRegistrationState = Draft & {
  setField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  addEvidence: (file: DraftEvidence) => void;
  removeEvidence: (evidenceType: ApiEvidenceType) => void;
  patchEvidence: (evidenceType: ApiEvidenceType, patch: Partial<DraftEvidence>) => void;
  addHouseholdMember: () => void;
  updateHouseholdMember: (index: number, patch: Partial<DraftHouseholdMember>) => void;
  removeHouseholdMember: (index: number) => void;
  /** Seeds the wizard from an existing registration for REG-04. */
  loadForEdit: (draft: Partial<Draft> & { registrationId: number }) => void;
  reset: () => void;
};

const initial: Draft = {
  registrationId: null,
  createdRegistrationId: null,
  vendorType: VENDOR_TYPE.itinerant,
  displayName: '',
  declaredAddress: '',
  addressLatitude: null,
  addressLongitude: null,
  wardUnitId: null,
  evidence: [],
  biometricConsent: false,
  ownerDateOfBirth: '',
  ownerGender: '',
  ownerEthnicity: '',
  ownerNationality: 'Việt Nam',
  idType: 'CCCD',
  idIssuedDate: '',
  idIssuedPlace: '',
  permanentAddress: '',
  contactAddress: '',
  businessLine: '',
  businessLineCode: '',
  capitalAmount: '',
  laborCount: '',
  plannedStartDate: '',
  foodSafetyCommitment: false,
  householdMembers: [],
};

/**
 * Evidence the user is asked for, by vendor type (MSG14).
 *
 * Both sides of the CCCD are required because the Mẫu số 01 fields are split across them:
 * the front carries số/họ tên/ngày sinh/giới tính/quốc tịch/địa chỉ, the back carries dân tộc,
 * ngày cấp and nơi cấp. The portrait is offered (step 3) but not required — a face match is
 * useful evidence for the reviewing officer, yet failing a third-party AI call must never be
 * what blocks a citizen from filing their registration.
 */
export function requiredEvidence(vendorType: ApiVendorType): ApiEvidenceType[] {
  const identity = [EVIDENCE_TYPE.identityDocument, EVIDENCE_TYPE.identityDocumentBack];
  return vendorType === VENDOR_TYPE.fixedStorefront
    ? [...identity, EVIDENCE_TYPE.businessLicense]
    : identity;
}

export const EVIDENCE_LABELS: Record<ApiEvidenceType, string> = {
  IDENTITY_DOCUMENT: 'CCCD mặt trước',
  IDENTITY_DOCUMENT_BACK: 'CCCD mặt sau',
  PORTRAIT_SELFIE: 'Ảnh chân dung',
  BUSINESS_LICENSE: 'Giấy phép kinh doanh',
  ADDRESS_PROOF: 'Giấy tờ địa chỉ',
  OTHER: 'Giấy tờ khác',
};

/**
 * Parses an optional decimal coordinate as the user types.
 *
 * `Number('16.06.78')` or `Number('abc')` is `NaN`, and `JSON.stringify` turns a
 * `NaN` into `null` silently — so a typo would submit as "no coordinate" with no
 * feedback at all. Returning `undefined` for anything unparseable lets the caller
 * discard the keystroke instead, so the field only ever holds a valid number.
 */
export function parseOptionalCoordinate(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Parses a VND amount typed with or without thousands separators. Empty text -> null. */
export function parseVndAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Client-side mirror of the backend's upload rules, checked when a file is picked. */
export function evidenceFileProblem(file: PickedFile): string | undefined {
  if (!EVIDENCE_ACCEPTED_TYPES.includes(file.type)) {
    return 'Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc file PDF.';
  }
  if ((file.size ?? 0) > EVIDENCE_MAX_BYTES) return 'Dung lượng file tối đa 5 MB.';
  return undefined;
}

/** The web revoked blob URLs here; picked files on a phone are plain file:// URIs. */
function revoke(_items: DraftEvidence[]) {}

const emptyHouseholdMember: DraftHouseholdMember = {
  fullName: '',
  dateOfBirth: '',
  idNumber: '',
  relationshipToOwner: '',
  capitalContribution: '',
};

/** Converts a submitted household member row back into draft (string) form for REG-04 edit. */
export function householdMemberToDraft(m: ApiHouseholdMember): DraftHouseholdMember {
  return {
    fullName: m.fullName,
    dateOfBirth: m.dateOfBirth ?? '',
    idNumber: m.idNumber ?? '',
    relationshipToOwner: m.relationshipToOwner ?? '',
    capitalContribution: m.capitalContribution != null ? String(m.capitalContribution) : '',
  };
}

/** Holds in-progress REG-01/02 form state across the multi-step wizard routes. */
export const useNewRegistrationStore = create<NewRegistrationState>((set, get) => ({
  ...initial,
  setField: (key, value) => set({ [key]: value } as Partial<Draft>),
  addEvidence: (file) => {
    revoke(get().evidence.filter((e) => e.evidenceType === file.evidenceType));
    set((s) => ({
      evidence: [...s.evidence.filter((e) => e.evidenceType !== file.evidenceType), file],
    }));
  },
  removeEvidence: (evidenceType) => {
    revoke(get().evidence.filter((e) => e.evidenceType === evidenceType));
    set((s) => ({ evidence: s.evidence.filter((e) => e.evidenceType !== evidenceType) }));
  },
  patchEvidence: (evidenceType, patch) =>
    set((s) => ({
      evidence: s.evidence.map((e) => (e.evidenceType === evidenceType ? { ...e, ...patch } : e)),
    })),
  addHouseholdMember: () =>
    set((s) => ({ householdMembers: [...s.householdMembers, { ...emptyHouseholdMember }] })),
  updateHouseholdMember: (index, patch) =>
    set((s) => ({
      householdMembers: s.householdMembers.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    })),
  removeHouseholdMember: (index) =>
    set((s) => ({ householdMembers: s.householdMembers.filter((_, i) => i !== index) })),
  loadForEdit: (draft) => {
    revoke(get().evidence);
    set({ ...initial, ...draft });
  },
  reset: () => {
    revoke(get().evidence);
    set(initial);
  },
}));

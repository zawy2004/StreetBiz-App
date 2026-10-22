import { appendFile, type PickedFile } from '@/core/api/upload';
import { apiGet, apiGetBlob, apiPathFromFileUrl, apiPost, apiPut, apiUpload } from './client';

/**
 * Mirrors StreetBiz-BE `VendorRegistrationController` (REG-01…REG-05).
 * Value sets come from `Application/Common/Security/VendorConstants.cs`.
 */

/** BusinessRegistrations.vendor_type (DB CHECK). */
export const VENDOR_TYPE = {
  fixedStorefront: 'FIXED_STOREFRONT',
  itinerant: 'ITINERANT',
} as const;

export type ApiVendorType = (typeof VENDOR_TYPE)[keyof typeof VENDOR_TYPE];

/** BusinessRegistrations.owner_gender values. */
export const OWNER_GENDER = {
  male: 'MALE',
  female: 'FEMALE',
  other: 'OTHER',
} as const;
export type ApiOwnerGender = (typeof OWNER_GENDER)[keyof typeof OWNER_GENDER];

/** BusinessRegistrations.id_type values -- the legal document backing owner identity. */
export const OWNER_ID_TYPE = {
  citizenId: 'CCCD',
  passport: 'PASSPORT',
} as const;
export type ApiOwnerIdType = (typeof OWNER_ID_TYPE)[keyof typeof OWNER_ID_TYPE];

/** BusinessRegistrations.registration_status (DB CHECK). */
export type RegistrationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'MORE_INFORMATION_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

/** Statuses a vendor may still edit — mirrors `RegistrationStatuses.Editable`. */
export const EDITABLE_STATUSES: RegistrationStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'MORE_INFORMATION_REQUIRED',
];

/** RegistrationEvidence.evidence_type (DB CHECK). */
export const EVIDENCE_TYPE = {
  /** CCCD mặt trước — số, họ tên, ngày sinh, giới tính, quốc tịch, địa chỉ thường trú. */
  identityDocument: 'IDENTITY_DOCUMENT',
  /** CCCD mặt sau — dân tộc, ngày cấp, nơi cấp (không in ở mặt trước). */
  identityDocumentBack: 'IDENTITY_DOCUMENT_BACK',
  /** Ảnh chân dung, để đối chiếu với ảnh in trên CCCD. */
  portraitSelfie: 'PORTRAIT_SELFIE',
  businessLicense: 'BUSINESS_LICENSE',
  addressProof: 'ADDRESS_PROOF',
  other: 'OTHER',
} as const;

export type ApiEvidenceType = (typeof EVIDENCE_TYPE)[keyof typeof EVIDENCE_TYPE];

export type ApiHouseholdMember = {
  memberId?: number;
  fullName: string;
  dateOfBirth: string | null;
  idNumber: string | null;
  relationshipToOwner: string | null;
  capitalContribution: number | null;
};

export type ApiRegistration = {
  registrationId: number;
  vendorType: ApiVendorType;
  displayName: string;
  declaredAddress: string | null;
  addressLatitude: number | null;
  addressLongitude: number | null;
  wardUnitId: number;
  registrationStatus: RegistrationStatus;
  fastTrackFlag: boolean;
  reviewDecisionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  // ---- Chủ hộ kinh doanh (Mẫu số 01 Phụ lục II, Thông tư 68/2025/TT-BTC) ----
  ownerDateOfBirth: string | null;
  ownerGender: ApiOwnerGender | null;
  ownerEthnicity: string | null;
  ownerNationality: string | null;
  idType: ApiOwnerIdType | null;
  idIssuedDate: string | null;
  idIssuedPlace: string | null;
  permanentAddress: string | null;
  contactAddress: string | null;
  // ---- Ngành nghề, quy mô hộ kinh doanh ----
  businessLine: string | null;
  businessLineCode: string | null;
  capitalAmount: number | null;
  laborCount: number | null;
  plannedStartDate: string | null;
  // ---- Cam kết ATTP / xác minh danh tính ----
  foodSafetyCommitmentAt: string | null;
  identityVerifiedAt: string | null;
  identityVerificationNote: string | null;
  householdMembers: ApiHouseholdMember[];
};

export type ApiEvidence = {
  evidenceId: number;
  registrationId: number;
  evidenceType: ApiEvidenceType;
  fileUrl: string;
  uploadedAt: string;
};

export type ApiRegistrationDetail = {
  registration: ApiRegistration;
  evidence: ApiEvidence[];
};

export type UploadedFile = {
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
};

/** Mirrors `EvidenceFiles` on the backend. */
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export type RegistrationPayload = {
  vendorType: ApiVendorType;
  displayName: string;
  declaredAddress: string | null;
  addressLatitude: number | null;
  addressLongitude: number | null;
  wardUnitId: number;
  ownerDateOfBirth: string | null;
  ownerGender: ApiOwnerGender | null;
  ownerEthnicity: string | null;
  ownerNationality: string | null;
  idType: ApiOwnerIdType | null;
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
  householdMembers: ApiHouseholdMember[];
};

export type EvidencePayload = {
  evidenceType: ApiEvidenceType;
  fileUrl: string;
  ocrExtractedData: string | null;
  /** Separate, explicit consent to later run AI-OCR on this photo (WARD-04/05/06's document
   * check) -- only meaningful (and only sent as true) for IDENTITY_DOCUMENT uploads. Luat Bao
   * ve du lieu ca nhan 2025 / Nghi dinh 356/2025/ND-CP requires this consent to be its own
   * affirmative action, never bundled into a general terms checkbox. */
  biometricConsent?: boolean;
};

export const vendorRegistrationApi = {
  /** REG-01. The controller wraps the created row in `{ message, data }`. */
  submit: async (payload: RegistrationPayload) => {
    const response = await apiPost<{ message: string; data: ApiRegistration }>(
      '/vendor/registrations',
      payload,
    );
    return response.data;
  },

  /** REG-01: files a complete draft with the ward (DRAFT -> SUBMITTED). Creating or updating a
   * draft never files it; until this is called the ward does not see the registration. */
  file: async (registrationId: number) => {
    const response = await apiPost<{ message: string; data: ApiRegistration }>(
      `/vendor/registrations/${registrationId}/submit`,
    );
    return response.data;
  },

  /** REG-03 */
  list: () => apiGet<ApiRegistration[]>('/vendor/registrations'),

  /** REG-03 detail, with the evidence documents attached so far. */
  get: (registrationId: number) =>
    apiGet<ApiRegistrationDetail>(`/vendor/registrations/${registrationId}`),

  /** Stores a document and returns the URL to attach with `submitEvidence`. */
  uploadEvidenceFile: (file: PickedFile) => {
    const form = new FormData();
    appendFile(form, file);
    return apiUpload<UploadedFile>('/uploads/evidence', form);
  },

  /** Evidence files require the bearer token, so they are fetched rather than linked. */
  downloadEvidenceFile: (fileUrl: string) => apiGetBlob(apiPathFromFileUrl(fileUrl)),

  /** REG-02 */
  submitEvidence: (registrationId: number, payload: EvidencePayload) =>
    apiPost<ApiEvidence>(`/vendor/registrations/${registrationId}/evidence`, payload),

  /** REG-04 — updating an editable registration also re-submits it for review. */
  update: (registrationId: number, payload: RegistrationPayload) =>
    apiPut<ApiRegistration>(`/vendor/registrations/${registrationId}`, payload),

  /** REG-05 */
  withdraw: (registrationId: number) =>
    apiPost<{ message: string }>(`/vendor/registrations/${registrationId}/withdraw`),

  /** Mẫu số 01 Phụ lục II, TT 68/2025/TT-BTC, filled with this registration's own data. Watermarked
   * "BẢN NHÁP" until the ward approves it. */
  downloadDocument: (registrationId: number, format: 'docx' | 'pdf'): Promise<Blob> =>
    apiGetBlob(`/vendor/registrations/${registrationId}/document?format=${format}`),
};

import { apiPost } from './client';

/**
 * REG-02 eKYC (mirrors StreetBiz-BE `VendorKycController`).
 *
 * Both calls spend real FPT.AI credits and are rate limited to 10/minute per account, so the
 * UI must only fire them on an explicit user action — never on render or on every keystroke.
 */

/** Fields read off the card. Everything is a suggestion the applicant may correct (BR-41). */
export type KycIdCardExtraction = {
  idNumber: string | null;
  fullName: string | null;
  /** ISO date (yyyy-MM-dd) or null when OCR could not read it. */
  dateOfBirth: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  nationality: string | null;
  /** Back side only. */
  ethnicity: string | null;
  permanentAddress: string | null;
  /** Back side only. */
  idIssuedDate: string | null;
  /** Back side only. */
  idIssuedPlace: string | null;
  confidencePercent: number;
  needsManualVerification: boolean;
  warnings: string[];
  isAiGenerated: boolean;
  summary: string;
};

export type KycFaceMatchResult = {
  isMatch: boolean;
  similarityPercent: number;
  /** True when both photos were ID cards — i.e. no real portrait was supplied. */
  bothImagesAreIdCards: boolean;
  needsManualVerification: boolean;
  warnings: string[];
  isAiGenerated: boolean;
  summary: string;
};

/** Both calls may try every FPT.AI key and then Gemini (the server stops at 45 s), so they get
 * longer than the client's 20 s default. */
const KYC_TIMEOUT_MS = 60_000;

export const vendorKycApi = {
  /**
   * Reads a CCCD. The back photo is optional but ngày cấp and nơi cấp (and dân tộc, on the old
   * CMND only -- chip CCCDs do not print it) are on the back, so leaving it out leaves them empty.
   */
  extractIdCard: (payload: {
    frontFileUrl: string;
    backFileUrl: string | null;
    biometricConsent: boolean;
  }) => apiPost<KycIdCardExtraction>('/vendor/kyc/id-card', payload, { timeout: KYC_TIMEOUT_MS }),

  /** Compares the portrait against the photo printed on the CCCD. JPG only (FPT.AI limit). */
  matchFace: (payload: {
    selfieFileUrl: string;
    idCardFrontFileUrl: string;
    biometricConsent: boolean;
  }) => apiPost<KycFaceMatchResult>('/vendor/kyc/face-match', payload, { timeout: KYC_TIMEOUT_MS }),
};

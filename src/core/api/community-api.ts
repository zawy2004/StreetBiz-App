import { apiGet, apiPost, apiPut, apiUploadFile, queryString } from './client';

/** Licensed vendors for buyers (BUY-01…05): StreetBiz-BE `CommunityVendorsController`. */

export type ActiveVendor = {
  vendorId: number;
  displayName: string;
  vendorType: string;
  address: string | null;
  permitId: number;
  permitEndDate: string;
  slotId: number;
  slotCode: string;
  zoneName: string;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
  communityRating: number | null;
  communityCount: number;
  verifiedRating: number | null;
  verifiedCount: number;
};

export type VendorCommentDto = { commentId: number; authorName: string; rating: number | null; commentText: string | null; createdAt: string };

export type PublicVendorProfile = {
  vendorId: number;
  displayName: string;
  vendorType: string;
  address: string | null;
  wardId: number;
  wardName: string | null;
  permitId: number;
  permitStatus: string;
  permitEndDate: string;
  slotId: number;
  slotCode: string;
  zoneName: string;
  latitude: number;
  longitude: number;
  communityRating: number | null;
  communityCount: number;
  verifiedRating: number | null;
  verifiedCount: number;
  comments: VendorCommentDto[];
};

export type PermitVerification = {
  isValid: boolean;
  status: string;
  permitId: number | null;
  vendorId: number | null;
  displayName: string | null;
  slotId: number | null;
  slotCode: string | null;
  latitude: number | null;
  longitude: number | null;
  validFrom: string | null;
  validUntil: string | null;
};

export type UploadedFile = { fileUrl: string; contentType: string; sizeBytes: number };

export const communityApi = {
  activeVendors: (near?: { latitude: number; longitude: number; radiusMeters: number }) =>
    apiGet<ActiveVendor[]>(`/community/vendors${queryString({ ...near })}`),
  profile: (vendorId: string | number) => apiGet<PublicVendorProfile>(`/community/vendors/${vendorId}`),
  verifyPermit: (qrPayload: string, point?: { latitude: number; longitude: number }) =>
    apiPost<PermitVerification>('/community/permits/verify', { qrPayload, ...point }),
  comment: (vendorId: string | number, rating: number, commentText: string) =>
    apiPut<VendorCommentDto>(`/community/vendors/${vendorId}/comment`, { rating, commentText }),
  report: (vendorId: string | number, input: { reason: string; evidenceUrl?: string; slotId?: number; scannedPermitId?: number }) =>
    apiPost<{ reportId: number; status: string }>(`/community/vendors/${vendorId}/reports`, input),
  /** Photo evidence (also used by vendor registrations and slot proposals). */
  uploadEvidence: (uri: string) => apiUploadFile<UploadedFile>('/uploads/evidence', uri),
};

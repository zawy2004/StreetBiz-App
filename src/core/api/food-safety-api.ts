import { apiGet, apiPost, apiPut } from './client';

/**
 * ATTP (food-safety) certificates for some dishes of a stall. The vendor submits, the ward
 * reviews and forwards the file to the department (Chi cục ATTP, outside the system), then
 * records the department's result.
 */
export type FoodSafetyStatus =
  | 'SUBMITTED'
  | 'MORE_INFORMATION_REQUIRED'
  | 'FORWARDED'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type FoodSafetyEvidenceType = 'CERTIFICATE' | 'HEALTH_CHECK' | 'TRAINING' | 'PREMISES_PHOTO' | 'OTHER';

export type FoodSafetyDecision =
  | 'FORWARD'
  | 'REQUEST_INFO'
  | 'REJECT'
  | 'RECORD_APPROVED'
  | 'RECORD_REJECTED';

export type FoodSafetyApplication = {
  applicationId: number;
  storefrontId: number;
  storefrontName: string;
  vendorName: string;
  status: FoodSafetyStatus;
  vendorNote: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  forwardedAt: string | null;
  departmentName: string | null;
  certificateNumber: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  isExpired: boolean;
  resultReason: string | null;
  resultRecordedAt: string | null;
  submittedAt: string;
  dishes: { menuItemId: number; name: string; categoryName: string; imageUrl: string | null }[];
  evidence: { evidenceType: FoodSafetyEvidenceType; fileUrl: string; uploadedAt: string }[];
  /** What the viewer may do next: vendor RESUBMIT/WITHDRAW, or the ward decisions. */
  actions: string[];
};

export type FoodSafetySubmitInput = {
  storefrontId: number;
  menuItemIds: number[];
  note: string | null;
  evidence: { evidenceType: FoodSafetyEvidenceType; fileUrl: string }[];
};

export type FoodSafetyDecisionInput = {
  decision: FoodSafetyDecision;
  reason: string;
  expectedStatus: FoodSafetyStatus;
  departmentName?: string | null;
  certificateNumber?: string | null;
  issuedOn?: string | null;
  expiresOn?: string | null;
};

export const FOOD_SAFETY_EVIDENCE_LABELS: Record<FoodSafetyEvidenceType, string> = {
  CERTIFICATE: 'Giấy chứng nhận / cam kết ATTP',
  HEALTH_CHECK: 'Giấy khám sức khỏe',
  TRAINING: 'Xác nhận tập huấn ATTP',
  PREMISES_PHOTO: 'Ảnh khu chế biến',
  OTHER: 'Giấy tờ khác',
};

export const foodSafetyApi = {
  mine: () => apiGet<FoodSafetyApplication[]>('/vendor/food-safety'),
  get: (id: number) => apiGet<FoodSafetyApplication>(`/vendor/food-safety/${id}`),
  submit: (input: FoodSafetySubmitInput) => apiPost<FoodSafetyApplication>('/vendor/food-safety', input),
  resubmit: (id: number, input: FoodSafetySubmitInput) =>
    apiPut<FoodSafetyApplication>(`/vendor/food-safety/${id}`, input),
  withdraw: (id: number) => apiPost<FoodSafetyApplication>(`/vendor/food-safety/${id}/withdraw`),

  wardList: (status?: FoodSafetyStatus) =>
    apiGet<FoodSafetyApplication[]>(`/ward/food-safety${status ? `?status=${status}` : ''}`),
  wardGet: (id: number) => apiGet<FoodSafetyApplication>(`/ward/food-safety/${id}`),
  decide: (id: number, input: FoodSafetyDecisionInput) =>
    apiPost<FoodSafetyApplication>(`/ward/food-safety/${id}/decision`, input),
};

import { appendFile, type PickedFile } from '@/core/api/upload';
import { ApiError } from '@/core/api/problem';
import { requestViaHttp } from '@/core/api/client';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

/** The web kept this in sessionStorage; a phone has none, so it lives for the app run. */
const memoryStore = new Map<string, string>();
const memoryStorage: StateStorage = {
  getItem: (k) => memoryStore.get(k) ?? null,
  setItem: (k, v) => void memoryStore.set(k, v),
  removeItem: (k) => void memoryStore.delete(k),
};


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

export type VendorComment = {
  commentId: number;
  authorName: string;
  rating: number | null;
  commentText: string | null;
  createdAt: string;
};

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
  comments: VendorComment[];
};

/** One dish on a stall's price board: VND integer price for one `priceUnit` ("ổ", "ly", "kg"…). */
export type PriceBoardItem = {
  menuItemId: number;
  name: string;
  nameEn: string | null;
  priceUnit: string;
  unitPrice: number;
};

/**
 * The stall's price board as the server read it with the permit (BUY-06, BR-39): never stored,
 * never reused. `version` is "Bản số N"; `printedVersionIsCurrent` says whether the paper board
 * scanned (its `?v=`) is this version, null when the scan carried no version.
 */
export type PublicPriceBoard = {
  version: number;
  updatedAt: string | null;
  printedVersionIsCurrent: boolean | null;
  items: PriceBoardItem[];
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
  /** Only when the permit is VALID and the stall keeps a board on StreetBiz; absent from an older server. */
  priceBoard?: PublicPriceBoard | null;
};

export type VendorReportType = 'GENERAL' | 'OVERCHARGE' | 'PRICE_NOT_POSTED';

export type VendorReportRequest = {
  reportType: VendorReportType;
  /** Required for GENERAL only; at most 500 characters. */
  reason?: string;
  evidenceUrl?: string;
  slotId?: number;
  scannedPermitId?: number;
  /** OVERCHARGE only. There is no posted-price field: the server reads it from the price history. */
  menuItemId?: number;
  quantity?: number;
  chargedAmount?: number;
  /** ISO instant with its offset. */
  purchasedAt?: string;
};

export type VendorReportReceipt = {
  reportId: number;
  status: string;
  reportType: VendorReportType;
  dueAt: string | null;
  postedAmount: number | null;
  chargedAmount: number | null;
};

/** An overcharge's evidence, computed by the server from the price history at the purchase time. */
export type ReportPriceEvidence = {
  menuItemId: number;
  itemName: string;
  priceUnit: string;
  postedUnitPrice: number;
  /** The board version ("bản số") the posted price comes from. */
  priceVersion: number;
  priceVersionAt: string;
  quantity: number;
  postedAmount: number;
  chargedAmount: number;
  difference: number;
  purchasedAt: string;
};

export type ReportResolution = 'DISMISSED' | 'MEDIATED' | 'VIOLATION_RECORDED';

/** "Phản ánh của tôi": the caller's own report and how the ward closed it. */
export type MyVendorReport = {
  reportId: number;
  vendorId: number | null;
  vendorName: string | null;
  slotCode: string | null;
  reportType: VendorReportType;
  reason: string;
  status: string;
  createdAt: string;
  dueAt: string | null;
  isOverdue: boolean;
  resolution: ReportResolution | null;
  resolutionNote: string | null;
  refundAmount: number | null;
  reviewedAt: string | null;
  hasPhoto: boolean;
  priceEvidence: ReportPriceEvidence | null;
};

/** GET /community/my-reports returns this many rows a page. */
export const MY_REPORTS_PAGE_SIZE = 20;

type CustomerIdentity = { id: number; fullName: string | null; roleCode: string };
type LoginResponse = {
  accessToken: string;
  user: { userId: number; fullName: string | null; roleCode: string };
};

type CommunitySession = {
  token: string;
  customer: CustomerIdentity | null;
  generation: number;
  connect: (token: string, customer: CustomerIdentity) => void;
  disconnect: () => void;
};

export const useCommunitySession = create<CommunitySession>()(
  persist(
    (set) => ({
      token: '',
      customer: null,
      generation: 0,
      connect: (token, customer) =>
        set((state) => ({ token, customer, generation: state.generation + 1 })),
      disconnect: () =>
        set((state) => ({ token: '', customer: null, generation: state.generation + 1 })),
    }),
    {
      name: 'streetbiz-community-api',
      storage: createJSONStorage(() => memoryStorage),
      partialize: ({ token, customer, generation }) => ({ token, customer, generation }),
    },
  ),
);

export class CommunityApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function communityRequest<T>(
  path: string,
  init: RequestInit = {},
  // Kept for call-site compatibility with the web; the shared client supplies the token.
  _token?: string,
): Promise<T> {
  try {
    return await requestViaHttp<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError) throw new CommunityApiError(error.status, error.message);
    throw error;
  }
}

export const communityApi = {
  activeVendors: (position?: { latitude: number; longitude: number; radiusMeters: number }) => {
    const query = position
      ? `?latitude=${position.latitude}&longitude=${position.longitude}&radiusMeters=${position.radiusMeters}`
      : '';
    return communityRequest<ActiveVendor[]>(`/community/vendors${query}`, {}, '');
  },
  profile: (vendorId: string | number) =>
    communityRequest<PublicVendorProfile>(
      `/community/vendors/${encodeURIComponent(vendorId)}`,
      {},
      '',
    ),
  /**
   * A fresh POST every time (BR-39): the answer is for the screen that asked, never kept. The
   * server takes the bare token or a /q/ link; `printedVersion` is the `?v=` of a paper board.
   */
  verifyPermit: (
    qrPayload: string,
    point?: { latitude: number; longitude: number },
    printedVersion?: number | null,
  ) =>
    communityRequest<PermitVerification>(
      '/community/permits/verify',
      {
        method: 'POST',
        body: JSON.stringify({ qrPayload, ...point, ...(printedVersion ? { printedVersion } : {}) }),
      },
      '',
    ),
  login: async (phoneNumber: string, password: string) => {
    const result = await communityRequest<LoginResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ phoneNumber, password }) },
      '',
    );
    if (result.user.roleCode !== 'CUSTOMER') {
      throw new CommunityApiError(403, 'Vui lòng đăng nhập bằng tài khoản người mua.');
    }
    const customer = {
      id: result.user.userId,
      fullName: result.user.fullName,
      roleCode: result.user.roleCode,
    };
    useCommunitySession.getState().connect(result.accessToken, customer);
    return customer;
  },
  comment: (vendorId: string | number, rating: number, commentText: string) =>
    communityRequest<VendorComment>(`/community/vendors/${encodeURIComponent(vendorId)}/comment`, {
      method: 'PUT',
      body: JSON.stringify({ rating, commentText }),
    }),
  uploadEvidence: async (file: PickedFile) => {
    const form = new FormData();
    appendFile(form, file);
    return communityRequest<{ fileUrl: string; contentType: string; sizeBytes: number }>(
      '/uploads/evidence',
      { method: 'POST', body: form },
    );
  },
  /** BUY-05 / BUY-07 (CUSTOMER). 409 while a report about this vendor is still pending. */
  report: (vendorId: string | number, request: VendorReportRequest) =>
    communityRequest<VendorReportReceipt>(
      `/community/vendors/${encodeURIComponent(vendorId)}/reports`,
      { method: 'POST', body: JSON.stringify(request) },
    ),
  /** The calling customer's own reports, newest first, MY_REPORTS_PAGE_SIZE a page. */
  myReports: (page = 1) => communityRequest<MyVendorReport[]>(`/community/my-reports?page=${page}`),
};

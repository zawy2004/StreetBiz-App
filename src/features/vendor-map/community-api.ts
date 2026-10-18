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

import { env } from '@/core/config/env';

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
  verifyPermit: (qrPayload: string, point?: { latitude: number; longitude: number }) =>
    communityRequest<PermitVerification>(
      '/community/permits/verify',
      {
        method: 'POST',
        body: JSON.stringify({ qrPayload, ...point }),
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
  report: (
    vendorId: string | number,
    request: {
      reason: string;
      evidenceUrl?: string;
      slotId?: number;
      scannedPermitId?: number;
    },
  ) =>
    communityRequest<{ reportId: number; status: string }>(
      `/community/vendors/${encodeURIComponent(vendorId)}/reports`,
      { method: 'POST', body: JSON.stringify(request) },
    ),
};

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

export type PlatformAdminProfile = { userId: number; name: string };

export type FoodCategory = {
  categoryId: number;
  categoryName: string;
  itemCount: number;
  createdByName: string | null;
};

export type ReportedContent = {
  reportId: number;
  contentType: string;
  contentId: number;
  contentTitle: string;
  contentBody: string | null;
  contentStatus: string;
  contentExists: boolean;
  reporterName: string;
  reason: string;
  status: string;
  reviewedByName: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type OrderComplaint = {
  complaintId: number;
  orderId: number;
  orderCode: string;
  orderStatus: string;
  customerName: string;
  storefrontName: string;
  complaintType: string;
  description: string;
  requestedRefundAmount: number | null;
  status: string;
  resolutionNotes: string | null;
  resolvedByName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  paymentAmount: number | null;
  paymentProvider: string | null;
  refundedAmount: number;
  latestRefundId: number | null;
  latestRefundStatus: string | null;
};

export type PlatformPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
};

type PlatformSession = {
  token: string;
  admin: PlatformAdminProfile | null;
  generation: number;
  connect: (token: string, admin: PlatformAdminProfile) => void;
  disconnect: () => void;
};

export const usePlatformSession = create<PlatformSession>()(
  persist(
    (set) => ({
      token: '',
      admin: null,
      generation: 0,
      connect: (token, admin) =>
        set((state) => ({ token, admin, generation: state.generation + 1 })),
      disconnect: () =>
        set((state) => ({ token: '', admin: null, generation: state.generation + 1 })),
    }),
    {
      name: 'streetbiz-platform-api',
      storage: createJSONStorage(() => memoryStorage),
      partialize: ({ token, admin, generation }) => ({ token, admin, generation }),
    },
  ),
);

export class PlatformApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function platformRequest<T>(
  path: string,
  init: RequestInit = {},
  // Kept for call-site compatibility with the web; the shared client supplies the token.
  _token?: string,
): Promise<T> {
  try {
    return await requestViaHttp<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError) throw new PlatformApiError(error.status, error.message);
    throw error;
  }
}

type LoginResponse = {
  accessToken: string;
  user: { userId: number; fullName: string | null; roleCode: string };
};

export const platformApi = {
  login: async (phoneNumber: string, password: string) => {
    const result = await platformRequest<LoginResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ phoneNumber, password }) },
      '',
    );
    if (result.user.roleCode !== 'PLATFORM_ADMIN') {
      await platformRequest<unknown>('/auth/logout', { method: 'POST' }, result.accessToken).catch(
        () => undefined,
      );
      throw new PlatformApiError(403, 'Vui lòng đăng nhập bằng tài khoản quản trị nền tảng.');
    }
    const admin = {
      userId: result.user.userId,
      name: result.user.fullName || `Quản trị viên #${result.user.userId}`,
    };
    usePlatformSession.getState().connect(result.accessToken, admin);
    return admin;
  },
  logout: async () => {
    const token = usePlatformSession.getState().token;
    try {
      if (token) {
        await platformRequest<unknown>('/auth/logout', { method: 'POST' }, token);
      }
    } finally {
      usePlatformSession.getState().disconnect();
    }
  },
  me: (token?: string) => platformRequest<PlatformAdminProfile>('/platform/me', {}, token),
  categories: () => platformRequest<FoodCategory[]>('/platform/food-categories'),
  createCategory: (name: string) =>
    platformRequest<FoodCategory>('/platform/food-categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  renameCategory: (categoryId: number, name: string) =>
    platformRequest<FoodCategory>(`/platform/food-categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),
  deleteCategory: (categoryId: number) =>
    platformRequest<void>(`/platform/food-categories/${categoryId}`, { method: 'DELETE' }),
  reportedContent: (status?: string) =>
    platformRequest<PlatformPage<ReportedContent>>(
      `/platform/reported-content${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),
  reportedContentDetail: (reportId: string | number) =>
    platformRequest<ReportedContent>(`/platform/reported-content/${encodeURIComponent(reportId)}`),
  decideReportedContent: (
    reportId: string | number,
    decision: 'dismiss' | 'hide',
    expectedStatus: string,
  ) =>
    platformRequest<ReportedContent>(
      `/platform/reported-content/${encodeURIComponent(reportId)}/${decision}`,
      { method: 'POST', body: JSON.stringify({ expectedStatus }) },
    ),
  /** Undoes a hide: the seller gets the content back (a store stays paused, a dish sold out). */
  restoreReportedContent: (reportId: string | number, expectedStatus: string) =>
    platformRequest<ReportedContent>(
      `/platform/reported-content/${encodeURIComponent(reportId)}/restore`,
      { method: 'POST', body: JSON.stringify({ expectedStatus }) },
    ),
  complaints: (status?: string) =>
    platformRequest<PlatformPage<OrderComplaint>>(
      `/platform/order-complaints${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),
  complaintDetail: (complaintId: string | number) =>
    platformRequest<OrderComplaint>(
      `/platform/order-complaints/${encodeURIComponent(complaintId)}`,
    ),
  decideComplaint: (
    complaintId: string | number,
    request: {
      decision: 'RESOLVE' | 'REJECT';
      notes: string;
      expectedStatus: string;
      approvedRefundAmount?: number;
    },
  ) =>
    platformRequest<OrderComplaint>(
      `/platform/order-complaints/${encodeURIComponent(complaintId)}/decision`,
      { method: 'POST', body: JSON.stringify(request) },
    ),
};

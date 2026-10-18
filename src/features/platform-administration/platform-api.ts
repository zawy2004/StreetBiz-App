import { ApiError } from '@/core/api/problem';
import { requestViaHttp } from '@/core/api/client';

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

export const platformApi = {
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

/**
 * RFC-7807 ProblemDetails as produced by StreetBiz-BE's GlobalExceptionHandler.
 * `type` carries the backend's error code (validation_error, conflict, ...) and
 * `errors` is only present on validation failures. Same contract as
 * StreetBiz-FE/src/core/api/problem.ts.
 */
export type ProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
  retryAfterSeconds?: number;
};

export type ApiErrorCode =
  | 'validation_error'
  | 'conflict'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'domain_rule'
  | 'otp_cooldown'
  | 'bad_request'
  | 'server_error'
  | 'network_error';

const FALLBACK_MESSAGES: Record<ApiErrorCode, string> = {
  validation_error: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  conflict: 'Thao tác không thực hiện được do trùng lặp hoặc đã thay đổi trạng thái.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  not_found: 'Không tìm thấy dữ liệu.',
  domain_rule: 'Thao tác không hợp lệ theo quy định.',
  otp_cooldown: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
  bad_request: 'Yêu cầu không hợp lệ.',
  server_error: 'Hệ thống đang bận. Vui lòng thử lại sau.',
  network_error: 'Không kết nối được máy chủ. Kiểm tra mạng và địa chỉ API rồi thử lại.',
};

/** Normalized error every API call rejects with, so screens never touch axios types. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Field name (as sent by the backend) -> messages, for validation failures. */
  readonly fieldErrors: Record<string, string[]>;
  /** Seconds until the request may be retried (429 OTP cooldown). */
  readonly retryAfterSeconds?: number;

  constructor(code: ApiErrorCode, status: number, message: string, fieldErrors: Record<string, string[]> = {}, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** First message for a backend field name (PascalCase from FluentValidation, matched case-insensitively). */
  fieldError(field: string): string | undefined {
    const key = Object.keys(this.fieldErrors).find((k) => k.toLowerCase() === field.toLowerCase());
    return key ? this.fieldErrors[key]?.[0] : undefined;
  }
}

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 400) return 'validation_error';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 413) return 'bad_request';
  if (status === 422) return 'domain_rule';
  if (status === 429) return 'otp_cooldown';
  return 'server_error';
}

const KNOWN_CODES = new Set<string>(Object.keys(FALLBACK_MESSAGES));

/** Builds an ApiError from a ProblemDetails body (or from a transport failure). */
export function toApiError(status: number | undefined, body: unknown): ApiError {
  if (status === undefined) return new ApiError('network_error', 0, FALLBACK_MESSAGES.network_error);

  const problem = (typeof body === 'object' && body !== null ? body : {}) as ProblemDetails;
  const code = problem.type && KNOWN_CODES.has(problem.type) ? (problem.type as ApiErrorCode) : codeFromStatus(status);
  const fieldErrors = problem.errors ?? {};
  // The backend's user-facing strings are already Vietnamese, so they are shown as-is.
  const message = problem.detail ?? Object.values(fieldErrors)[0]?.[0] ?? FALLBACK_MESSAGES[code];
  return new ApiError(code, status, message, fieldErrors, problem.retryAfterSeconds);
}

/**
 * True when a 401 came from the JWT middleware (missing, expired or revoked
 * token): it answers with an empty body. Only that is worth a refresh-and-retry.
 */
export function isTokenFailure(status: number | undefined, body: unknown): boolean {
  if (status !== 401) return false;
  if (body === undefined || body === null) return true;
  return typeof body === 'string' && body.trim() === '';
}

/** Safe message for any thrown value, for catch blocks and error states. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return FALLBACK_MESSAGES.server_error;
}

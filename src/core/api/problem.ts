/**
 * RFC-7807 ProblemDetails as produced by StreetBiz-BE's GlobalExceptionHandler.
 * `type` carries the backend's error code (validation_error, conflict, ...) and
 * `errors` is only present on validation failures.
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
  | 'network_error'
  | 'timeout'
  | 'ai_unavailable';

const FALLBACK_MESSAGES: Record<ApiErrorCode, string> = {
  validation_error: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  conflict: 'Thao tác không thực hiện được do trùng lặp hoặc đã thay đổi trạng thái.',
  unauthorized: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  not_found: 'Không tìm thấy dữ liệu.',
  domain_rule: 'Thao tác không hợp lệ theo quy định.',
  // Named for the OTP cooldown, but 429 also covers the ward geocode limiter,
  // which answers with an empty body and so always lands on this fallback.
  // Call sites that need OTP-specific wording branch on `code` and
  // `retryAfterSeconds`, not on this string.
  otp_cooldown: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
  bad_request: 'Yêu cầu không hợp lệ.',
  server_error: 'Hệ thống đang bận. Vui lòng thử lại sau.',
  network_error: 'Không kết nối được máy chủ. Kiểm tra kết nối mạng và thử lại.',
  timeout: 'Máy chủ xử lý quá lâu nên đã dừng chờ. Vui lòng thử lại sau ít phút.',
  // 503 from an AI-backed endpoint (speech-to-text and every model are down or out of quota):
  // the caller falls back to manual entry.
  ai_unavailable: 'Trợ lý AI đang bận. Bạn có thể điền tiếp bằng tay.',
};

/** Normalized error every API call rejects with, so screens never touch axios types. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Field name (as sent by the backend) -> messages, for validation failures. */
  readonly fieldErrors: Record<string, string[]>;
  /** Seconds until the request may be retried (429 OTP cooldown). */
  readonly retryAfterSeconds?: number;
  activeMessageId?: string;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    fieldErrors: Record<string, string[]> = {},
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /**
   * First message for a backend field name. The backend uses PascalCase
   * (FluentValidation property names), so lookups are case-insensitive.
   */
  fieldError(field: string): string | undefined {
    const key = Object.keys(this.fieldErrors).find((k) => k.toLowerCase() === field.toLowerCase());
    return key ? this.fieldErrors[key]?.[0] : undefined;
  }

  get isValidation(): boolean {
    return this.code === 'validation_error';
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

/** The request was sent but no answer came back in time -- not the same as being offline. */
export function timeoutError(): ApiError {
  return new ApiError('timeout', 0, FALLBACK_MESSAGES.timeout);
}

/** Builds an ApiError from a ProblemDetails body (or from a transport failure). */
export function toApiError(status: number | undefined, body: unknown): ApiError {
  if (status === undefined) {
    return new ApiError('network_error', 0, FALLBACK_MESSAGES.network_error);
  }

  // The assistant uses the data/error/meta envelope without changing legacy APIs.
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error?: { message?: unknown; activeMessageId?: unknown } }).error;
    if (error && typeof error.message === 'string') {
      const result = new ApiError(codeFromStatus(status), status, error.message);
      if (typeof error.activeMessageId === 'string') result.activeMessageId = error.activeMessageId;
      return result;
    }
  }

  const problem = (typeof body === 'object' && body !== null ? body : {}) as ProblemDetails;
  const code =
    problem.type && KNOWN_CODES.has(problem.type)
      ? (problem.type as ApiErrorCode)
      : codeFromStatus(status);

  // The API's user-facing strings are already Vietnamese (AppMessages/RegMessages),
  // so they are shown as-is; only the code-level fallbacks live here.
  const fieldErrors = problem.errors ?? {};

  // For AppExceptions the backend puts the human message in `detail`; for
  // validation failures `detail` is absent, so prefer the first field message.
  const message = problem.detail ?? Object.values(fieldErrors)[0]?.[0] ?? FALLBACK_MESSAGES[code];

  return new ApiError(code, status, message, fieldErrors, problem.retryAfterSeconds);
}

/**
 * True when a 401 came from the JWT middleware (missing, expired or revoked
 * token), as opposed to a handler rejecting the request. Only the former is
 * worth a refresh-and-retry; the middleware answers with an empty body.
 */
export function isTokenFailure(status: number | undefined, body: unknown): boolean {
  if (status !== 401) return false;
  if (body === undefined || body === null) return true;
  if (typeof body === 'object' && body !== null && 'error' in body) {
    return (body as { error?: { code?: string } }).error?.code === 'session_expired';
  }
  return typeof body === 'string' && body.trim() === '';
}

/** Safe message extraction for any thrown value, for use in catch blocks. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return FALLBACK_MESSAGES.server_error;
}

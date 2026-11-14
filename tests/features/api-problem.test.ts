import {
  ApiError,
  errorMessage,
  isTokenFailure,
  timeoutError,
  toApiError,
} from '@/core/api/problem';

describe('toApiError (ProblemDetails from StreetBiz-BE)', () => {
  it('reports a transport failure as a network error', () => {
    const error = toApiError(undefined, undefined);
    expect(error.code).toBe('network_error');
    expect(error.status).toBe(0);
  });

  it('uses the first field message of a validation failure and looks fields up case-insensitively', () => {
    const error = toApiError(400, {
      type: 'validation_error',
      status: 400,
      errors: { PhoneNumber: ['Số điện thoại không hợp lệ.'] },
    });
    expect(error.isValidation).toBe(true);
    expect(error.message).toBe('Số điện thoại không hợp lệ.');
    expect(error.fieldError('phoneNumber')).toBe('Số điện thoại không hợp lệ.');
    expect(error.fieldError('password')).toBeUndefined();
  });

  it('keeps the OTP cooldown and its retry delay', () => {
    const error = toApiError(429, {
      type: 'otp_cooldown',
      detail: 'Vui lòng chờ trước khi yêu cầu mã xác thực mới.',
      retryAfterSeconds: 60,
    });
    expect(error.code).toBe('otp_cooldown');
    expect(error.retryAfterSeconds).toBe(60);
    expect(error.message).toBe('Vui lòng chờ trước khi yêu cầu mã xác thực mới.');
  });

  it('falls back to the status code and a Vietnamese message for an unknown type or empty body', () => {
    const unknown = toApiError(422, { type: 'something_new' });
    expect(unknown.code).toBe('domain_rule');
    expect(unknown.message).toBe('Thao tác không hợp lệ theo quy định.');

    expect(toApiError(403, '').code).toBe('forbidden');
    expect(toApiError(404, null).code).toBe('not_found');
    expect(toApiError(500, undefined).code).toBe('server_error');
  });

  it('reads the assistant envelope { error: { message, activeMessageId } }', () => {
    const error = toApiError(409, {
      error: { message: 'Đang trả lời câu trước.', activeMessageId: 'm-1' },
    });
    expect(error.code).toBe('conflict');
    expect(error.message).toBe('Đang trả lời câu trước.');
    expect(error.activeMessageId).toBe('m-1');
  });

  it('builds a timeout error distinct from being offline', () => {
    const error = timeoutError();
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('timeout');
  });
});

describe('isTokenFailure (decides whether to refresh and retry)', () => {
  it('treats an empty-body 401 from the JWT middleware as a token failure', () => {
    expect(isTokenFailure(401, undefined)).toBe(true);
    expect(isTokenFailure(401, '')).toBe(true);
    expect(isTokenFailure(401, { error: { code: 'session_expired' } })).toBe(true);
  });

  it('does not retry a 401 a handler sent on purpose, or any other status', () => {
    expect(isTokenFailure(401, { type: 'unauthorized', detail: 'Mã xác thực không đúng.' })).toBe(
      false,
    );
    expect(isTokenFailure(401, { error: { code: 'wrong_otp' } })).toBe(false);
    expect(isTokenFailure(403, undefined)).toBe(false);
  });
});

describe('errorMessage', () => {
  it('prefers the ApiError or Error message and never shows a raw value', () => {
    expect(errorMessage(new ApiError('conflict', 409, 'Đã tồn tại.'))).toBe('Đã tồn tại.');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage(42)).toBe('Hệ thống đang bận. Vui lòng thử lại sau.');
  });
});

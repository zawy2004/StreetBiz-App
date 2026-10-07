import { isLiveApi } from '@/core/config/env';

/**
 * BR-59 as StreetBiz-BE enforces it (AuthValidationRules.PasswordRegex): 8+
 * characters with upper, lower, digit and symbol, no spaces. The demo data
 * keeps its simple "123456" accounts, so the mock mode only asks for 6.
 */
export function passwordProblem(password: string): string | undefined {
  if (!isLiveApi) return password.length < 6 ? 'Mật khẩu cần ít nhất 6 ký tự' : undefined;
  if (password.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự';
  if (/\s/.test(password)) return 'Mật khẩu không được có khoảng trắng';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Cần cả chữ hoa và chữ thường';
  if (!/\d/.test(password)) return 'Cần ít nhất một chữ số';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Cần ít nhất một ký tự đặc biệt (vd. !@#)';
  return undefined;
}

export const PASSWORD_HINT = isLiveApi ? 'Ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.' : 'Ít nhất 6 ký tự.';

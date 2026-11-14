/**
 * Mirrors StreetBiz-BE `AuthValidationRules.PasswordRegex()` (BR-59):
 * at least 8 characters with an upper, a lower, a digit and a special
 * character, and no whitespace.
 *
 * Checking client-side is purely so the user sees the rules before submitting —
 * the backend remains the authority.
 */
export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: `Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`,
    test: (v) => v.length >= PASSWORD_MIN_LENGTH,
  },
  { id: 'lower', label: 'Có chữ thường (a-z)', test: (v) => /[a-z]/.test(v) },
  { id: 'upper', label: 'Có chữ in hoa (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { id: 'digit', label: 'Có chữ số (0-9)', test: (v) => /\d/.test(v) },
  { id: 'special', label: 'Có ký tự đặc biệt (!@#...)', test: (v) => /[^\w\s]/.test(v) },
  { id: 'nospace', label: 'Không chứa khoảng trắng', test: (v) => v.length > 0 && !/\s/.test(v) },
];

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

/** The first unmet rule, for a single inline message under the field. */
export function passwordError(value: string): string | undefined {
  const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
  return failed ? `Mật khẩu chưa đạt: ${failed.label.toLowerCase()}.` : undefined;
}

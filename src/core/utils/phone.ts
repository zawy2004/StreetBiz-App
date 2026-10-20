/**
 * Phone helpers matching StreetBiz-BE `AuthValidationRules.PhoneRegex()`,
 * which accepts a local `0XXXXXXXXX` (10 digits) or `+84XXXXXXXXX`.
 * The UI shows a "+84" prefix and the user types the 9 digits after it, so
 * everything is normalized to the local 0-prefixed form before it is sent.
 */

/** Normalizes a "+84 xxx" field entry (no leading 0) to a local 0-prefixed number. */
export function toLocalPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length === 11) return `0${digits.slice(2)}`;
  return digits.startsWith('0') ? digits : `0${digits}`;
}

/** True when the normalized value is a shape the backend will accept. */
export function isValidPhone(input: string): boolean {
  return /^0\d{9}$/.test(toLocalPhone(input));
}

export function phoneError(input: string): string | undefined {
  if (!input.trim()) return 'Vui lòng nhập số điện thoại.';
  return isValidPhone(input) ? undefined : 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0.';
}

/** Presentation only: 0905 000 001. */
export function formatPhone(input: string): string {
  const local = toLocalPhone(input);
  if (!/^0\d{9}$/.test(local)) return input;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

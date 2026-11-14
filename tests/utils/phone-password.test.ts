import { isPasswordValid, passwordError } from '@/core/auth/password-policy';
import { formatPhone, isValidPhone, phoneError, toLocalPhone } from '@/core/utils/phone';

describe('phone (matches the backend PhoneRegex)', () => {
  it('normalises the "+84" field entry, a full +84 number and a local number to 0XXXXXXXXX', () => {
    expect(toLocalPhone('905000101')).toBe('0905000101');
    expect(toLocalPhone('+84 905 000 101')).toBe('0905000101');
    expect(toLocalPhone('0905 000 101')).toBe('0905000101');
  });

  it('accepts only 10 digits starting with 0 after normalising', () => {
    expect(isValidPhone('905000101')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidPhone('09050001011')).toBe(false);
  });

  it('asks for a number when empty and explains the shape when wrong', () => {
    expect(phoneError('  ')).toBe('Vui lòng nhập số điện thoại.');
    expect(phoneError('123')).toBe('Số điện thoại phải gồm 10 số, bắt đầu bằng 0.');
    expect(phoneError('905000101')).toBeUndefined();
  });

  it('groups a valid number as 0905 000 101 and leaves anything else untouched', () => {
    expect(formatPhone('905000101')).toBe('0905 000 101');
    expect(formatPhone('abc')).toBe('abc');
  });
});

describe('password policy (BR-59, mirrors the backend PasswordRegex)', () => {
  it('accepts the demo password', () => {
    expect(isPasswordValid('Password123!')).toBe(true);
    expect(passwordError('Password123!')).toBeUndefined();
  });

  it.each([
    ['Pa1!', 'tối thiểu 8 ký tự'],
    ['PASSWORD123!', 'có chữ thường (a-z)'],
    ['password123!', 'có chữ in hoa (a-z)'],
    ['Password!!', 'có chữ số (0-9)'],
    ['Password123', 'có ký tự đặc biệt (!@#...)'],
    ['Pass word1!', 'không chứa khoảng trắng'],
  ])('rejects %s with the first unmet rule', (value, rule) => {
    expect(isPasswordValid(value)).toBe(false);
    expect(passwordError(value)).toBe(`Mật khẩu chưa đạt: ${rule}.`);
  });

  it('rejects an empty password', () => {
    expect(isPasswordValid('')).toBe(false);
  });
});

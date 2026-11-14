import { parseFineBracket } from '@/features/ward-administration/violation-utils';

describe('parseFineBracket (same pattern as LegalBasisText.TryParseBracket)', () => {
  it('reads the bracket a legal basis ends with', () => {
    expect(parseFineBracket('Điểm a khoản 1 Điều 12 (khung 2.000.000 - 3.000.000đ)')).toEqual({ min: 2_000_000, max: 3_000_000 });
    expect(parseFineBracket('(khung 500.000-1.000.000 đ)')).toEqual({ min: 500_000, max: 1_000_000 });
  });

  it('is null where the server finds no bracket', () => {
    expect(parseFineBracket('khung 2.000.000 - 3.000.000đ')).toBeNull();
    expect(parseFineBracket('Khoản 2 Điều 12')).toBeNull();
    expect(parseFineBracket(undefined)).toBeNull();
  });
});

import { daysUntil, formatVnd, parseDate } from '@/utils/format';
import { distanceMeters } from '@/utils/geo';

describe('format helpers', () => {
  it('formats money in Vietnamese style', () => {
    expect(formatVnd(1050000)).toMatch(/^1[.  ]050[.  ]000 đ$/);
  });

  it('parses a real DD/MM/YYYY date and rejects impossible ones', () => {
    expect(parseDate('07/10/2026')?.format('YYYY-MM-DD')).toBe('2026-10-07');
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('2026-10-07')).toBeNull();
  });

  it('counts days until a date, negative once past', () => {
    expect(daysUntil('2000-01-01T00:00:00.000Z')).toBeLessThan(0);
  });
});

describe('geo', () => {
  it('measures a short distance in metres', () => {
    const d = distanceMeters({ lat: 16.0601, lng: 108.2198 }, { lat: 16.0602, lng: 108.2199 });
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(25);
  });
});

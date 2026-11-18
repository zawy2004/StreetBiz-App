import { fold } from '@/features/buyer-discovery/food-photos';
import {
  formatDueDay,
  contractProgress,
  formatDate,
  formatDistance,
  formatVietnamTime,
  formatVnd,
} from '@/utils/format';

describe('format (ported from the web)', () => {
  it('formats distance like the web: metres under 1 km, one decimal above', () => {
    expect(formatDistance(120)).toBe('120 m');
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(1250)).toMatch(/^1[,.]3 km$/);
  });

  it('formats VND as an integer amount', () => {
    expect(formatVnd(1350000)).toMatch(/^1[.,]350[.,]000 đ$/);
  });

  it('counts the days left of a contract with the end date included', () => {
    const p = contractProgress('2026-10-01', '2026-12-31', new Date(2026, 9, 17));
    expect(p.daysLeft).toBe(75);
    expect(p.expiringSoon).toBe(false);
    expect(contractProgress('2026-10-01', '2026-10-20', new Date(2026, 9, 17)).expiringSoon).toBe(
      true,
    );
  });

  it('reads ISO dates as calendar dates and times in Asia/Ho_Chi_Minh', () => {
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
    expect(formatVietnamTime(Date.UTC(2026, 9, 17, 11, 42, 5))).toBe('18:42:05');
  });

  it('folds Vietnamese text without String.normalize', () => {
    expect(fold('Bánh mì Phượng Hàn')).toBe('banh mi phuong han');
    expect(fold('Đồ uống')).toBe('do uong');
  });
});

describe('formatDueDay', () => {
  it('names the day a due instant closes: the server sends the next midnight in Việt Nam', () => {
    // 2026-11-03T17:00:00Z is 00:00 on 04/11 in Việt Nam, the end of 03/11.
    expect(formatDueDay('2026-11-03T17:00:00Z')).toBe('hết ngày 03/11/2026');
    expect(formatDueDay('2026-11-03T16:59:59Z')).toBe('hết ngày 03/11/2026');
    expect(formatDueDay(null)).toBe('');
  });
});

import {
  minutesOf,
  rulerAxis,
  rulerSpans,
  todayStatus,
  vietnamClock,
} from '@/features/buyer-discovery/storefront-hours';

// 2026-11-14 is a Saturday (ISO day 6). Times are written in UTC; Vietnam is UTC+7.
const at = (utc: string) => new Date(`2026-11-14T${utc}:00Z`);
const SAT = 6;

describe('storefront hours', () => {
  it('reads "HH:mm" and "HH:mm:ss" as minutes after midnight', () => {
    expect(minutesOf('10:00')).toBe(600);
    expect(minutesOf('21:30:00')).toBe(1290);
  });

  it('reads the weekday and time on the Vietnam clock, not the device clock', () => {
    expect(vietnamClock(at('05:00'))).toEqual({ day: SAT, minutes: 12 * 60 });
    // 18:00 UTC on Saturday is already 01:00 on Sunday in Vietnam.
    expect(vietnamClock(at('18:00'))).toEqual({ day: 7, minutes: 60 });
  });

  it('says when an open stall closes', () => {
    const hours = [{ dayOfWeek: SAT, opensAt: '10:00:00', closesAt: '21:00:00' }];
    expect(todayStatus(hours, true, at('05:00'))).toBe('Đang mở, đóng lúc 21:00');
  });

  it("covers last night's window when it runs past midnight", () => {
    const hours = [{ dayOfWeek: 5, opensAt: '18:00', closesAt: '02:00' }];
    // Saturday 01:00 in Vietnam.
    expect(todayStatus(hours, true, new Date('2026-11-13T18:00:00Z'))).toBe(
      'Đang mở, đóng lúc 02:00',
    );
  });

  it('says when a closed stall opens again: today, tomorrow, a weekday or next week', () => {
    const saturday = { dayOfWeek: SAT, opensAt: '10:00', closesAt: '21:00' };
    // Saturday 08:00 and 22:00 in Vietnam.
    expect(todayStatus([saturday], false, at('01:00'))).toBe('Đang đóng, mở lại 10:00 hôm nay');
    expect(
      todayStatus(
        [saturday, { dayOfWeek: 7, opensAt: '09:00', closesAt: '12:00' }],
        false,
        at('15:00'),
      ),
    ).toBe('Đang đóng, mở lại 09:00 ngày mai');
    expect(
      todayStatus(
        [saturday, { dayOfWeek: 1, opensAt: '07:00', closesAt: '11:00' }],
        false,
        at('15:00'),
      ),
    ).toBe('Đang đóng, mở lại 07:00 thứ hai');
    expect(todayStatus([saturday], false, at('15:00'))).toBe(
      'Đang đóng, mở lại 10:00 thứ bảy tuần sau',
    );
  });

  it('says nothing when no hours are published or they disagree with the server', () => {
    const hours = [{ dayOfWeek: SAT, opensAt: '10:00', closesAt: '21:00' }];
    expect(todayStatus([], true, at('05:00'))).toBeNull();
    // Server says open, but the published hours say closed (and the other way round).
    expect(todayStatus(hours, true, at('01:00'))).toBeNull();
    expect(todayStatus(hours, false, at('05:00'))).toBeNull();
  });

  it('places windows on a 05:00–24:00 ruler that starts earlier for an early stall', () => {
    const hours = [{ dayOfWeek: SAT, opensAt: '10:00', closesAt: '21:00' }];
    const axis = rulerAxis(hours);
    expect(axis).toEqual({ start: 300, end: 1440 });
    const [span] = rulerSpans(hours, SAT, axis);
    expect(span?.left).toBeCloseTo(300 / 1140);
    expect(span?.width).toBeCloseTo(660 / 1140);
    expect(rulerSpans(hours, 1, axis)).toEqual([]);

    expect(rulerAxis([{ dayOfWeek: SAT, opensAt: '04:30', closesAt: '09:00' }]).start).toBe(240);
  });

  it('runs an overnight window to the end of the ruler', () => {
    const axis = { start: 300, end: 1440 };
    const [span] = rulerSpans([{ dayOfWeek: SAT, opensAt: '18:00', closesAt: '02:00' }], SAT, axis);
    expect(span?.left).toBeCloseTo(780 / 1140);
    expect(span?.width).toBeCloseTo(360 / 1140);
  });
});

import {
  feedbackPhoneLabel,
  feedbackSiteLabel,
  nowMoment,
  overchargeMath,
  purchaseDays,
  purchaseIso,
  purchaseProblem,
  reportStatusLabel,
  resolveErrors,
  violationDescriptionFromReport,
  wholeNumber,
} from '@/features/vendor-reports/report-view';

// 23/10/2026 12:30 in Đà Nẵng (05:30 UTC), a Friday.
const NOW = Date.UTC(2026, 9, 23, 5, 30);

describe('overcharge math (what the complaint form shows as the buyer types)', () => {
  it('posted = unit price × quantity, difference = charged − posted', () => {
    expect(overchargeMath(25_000, 2, 70_000)).toEqual({ posted: 50_000, difference: 20_000, above: true });
  });

  it('blocks the type when the amount paid is not above the posted amount', () => {
    expect(overchargeMath(25_000, 2, 50_000)).toEqual({ posted: 50_000, difference: 0, above: false });
    expect(overchargeMath(25_000, 2, 40_000).above).toBe(false);
  });

  it('knows nothing until a dish and an amount are given', () => {
    expect(overchargeMath(undefined, 2, 70_000)).toEqual({ posted: null, difference: null, above: false });
    expect(overchargeMath(25_000, 1, null)).toEqual({ posted: 25_000, difference: null, above: false });
  });

  it('reads typed money as whole VND', () => {
    expect(wholeNumber('70.000 đ')).toBe(70_000);
    expect(wholeNumber('')).toBeNull();
  });
});

describe('purchase time on the Vietnamese clock', () => {
  it('defaults to now and sends it with the +07:00 offset', () => {
    const now = nowMoment(NOW);
    expect(now).toEqual({ daysAgo: 0, hour: 12, minute: 30 });
    expect(purchaseIso(now, NOW)).toBe('2026-10-23T12:30:00+07:00');
    expect(purchaseIso({ daysAgo: 1, hour: 23, minute: 5 }, NOW)).toBe('2026-10-22T23:05:00+07:00');
    expect(purchaseProblem(now, NOW)).toBeNull();
  });

  it('refuses a time later today than now', () => {
    expect(purchaseProblem({ daysAgo: 0, hour: 13, minute: 0 }, NOW)).toBe('Giờ mua không được sau thời điểm hiện tại.');
  });

  it('offers today and the six days before it, all inside the 7-day window', () => {
    const days = purchaseDays(NOW);
    expect(days.map((d) => d.label)).toEqual(['Hôm nay', 'Hôm qua', 'T4 21/10', 'T3 20/10', 'T2 19/10', 'CN 18/10', 'T7 17/10']);
    expect(purchaseProblem({ daysAgo: 6, hour: 0, minute: 0 }, NOW)).toBeNull();
    expect(purchaseProblem({ daysAgo: 7, hour: 12, minute: 0 }, NOW)).toBe('Chỉ phản ánh được lần mua trong 7 ngày gần nhất.');
  });
});

describe('closing a report (WARD-19 validation before the server checks again)', () => {
  it('"Bác" needs a reason the reporter will read', () => {
    expect(resolveErrors('DISMISSED', '  ', '', null).note).toBe('Nhập lý do bác. Người phản ánh sẽ đọc lý do này.');
    expect(resolveErrors('DISMISSED', 'Đã kiểm tra, giá đúng bảng.', '', null)).toEqual({});
  });

  it('"Đã hòa giải" needs a note; a refund is optional and never above what was charged', () => {
    expect(resolveErrors('MEDIATED', '', '', 70_000).note).toBe('Nhập ghi chú hòa giải.');
    expect(resolveErrors('MEDIATED', 'Đã hoàn tiền', '', 70_000)).toEqual({});
    expect(resolveErrors('MEDIATED', 'Đã hoàn tiền', '20000', 70_000)).toEqual({});
    expect(resolveErrors('MEDIATED', 'Đã hoàn tiền', '70000', 70_000)).toEqual({});
    expect(resolveErrors('MEDIATED', 'Đã hoàn tiền', '70001', 70_000).refund).toBe('Không được vượt số tiền khách bị tính (70.000 đ).');
    expect(resolveErrors('MEDIATED', 'Đã hoàn tiền', '1.5', 70_000).refund).toBe('Số tiền hoàn là số nguyên VND không âm.');
  });

  it('caps the note at 500 characters', () => {
    expect(resolveErrors('DISMISSED', 'x'.repeat(501), '', null).note).toBe('Tối đa 500 ký tự.');
  });
});

describe('words shown for a report', () => {
  it('says where a report stands, overdue in red', () => {
    expect(reportStatusLabel({ status: 'PENDING', isOverdue: false })).toEqual({ label: 'Chờ phường xử lý', tone: 'pending' });
    expect(reportStatusLabel({ status: 'PENDING', isOverdue: true })).toEqual({ label: 'Quá hạn xử lý', tone: 'danger' });
    expect(reportStatusLabel({ status: 'DISMISSED', resolution: 'DISMISSED' }).label).toBe('Đã bác');
    expect(reportStatusLabel({ status: 'REVIEWED', resolution: 'MEDIATED' }).label).toBe('Đã hòa giải');
    expect(reportStatusLabel({ status: 'REVIEWED', resolution: 'VIOLATION_RECORDED' }).label).toBe('Đã lập biên bản');
    expect(reportStatusLabel({ status: 'REVIEWED', resolution: null }).label).toBe('Đã xem xét');
  });

  it('prefills the biên bản with the server price evidence', () => {
    const text = violationDescriptionFromReport({
      reportId: 41,
      reportType: 'OVERCHARGE',
      reason: 'Bị tính cao hơn giá niêm yết: 2 ổ Bánh mì thịt.',
      createdAt: '2026-10-23T05:00:00Z',
      priceEvidence: {
        menuItemId: 3,
        itemName: 'Bánh mì thịt',
        priceUnit: 'ổ',
        postedUnitPrice: 25_000,
        priceVersion: 4,
        priceVersionAt: '2026-10-20T01:00:00Z',
        quantity: 2,
        postedAmount: 50_000,
        chargedAmount: 70_000,
        difference: 20_000,
        purchasedAt: '2026-10-23T04:30:00Z',
      },
    });
    expect(text).toContain('Theo phản ánh #41 của người dân (Bán cao hơn giá niêm yết, gửi 23/10/2026 12:00)');
    expect(text).toContain('bán 2 ổ Bánh mì thịt giá 70.000 đ, cao hơn giá niêm yết 50.000 đ (bảng giá bản số 4) là 20.000 đ, lúc 23/10/2026 11:30.');
  });

  it("formats Đà Nẵng's 1022 from config", () => {
    expect(feedbackPhoneLabel('02361022')).toBe('(0236) 1022');
    expect(feedbackPhoneLabel('1900 1234')).toBe('1900 1234');
    expect(feedbackSiteLabel('https://gopy.danang.gov.vn/')).toBe('gopy.danang.gov.vn');
  });
});

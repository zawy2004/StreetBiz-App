import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { ApiError } from '@/core/api/problem';
import { WardReportDetailScreen } from '@/features/vendor-reports/screens/WardReportScreens';
import { wardReportsApi, type WardVendorReport } from '@/features/vendor-reports/ward-reports-api';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ id: '41' }),
}));
jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('@/features/vendor-reports/ward-reports-api', () => ({
  ...jest.requireActual('@/features/vendor-reports/ward-reports-api'),
  wardReportsApi: { list: jest.fn(), get: jest.fn(), assist: jest.fn(), resolve: jest.fn() },
}));

const api = wardReportsApi as unknown as Record<'get' | 'resolve' | 'assist', jest.Mock>;

const pending: WardVendorReport = {
  reportId: 41,
  reason: 'Bị tính cao hơn giá niêm yết: 2 ổ Bánh mì thịt.',
  evidenceUrl: null,
  status: 'PENDING',
  createdAt: '2026-10-23T05:00:00Z',
  vendorName: 'Bánh mì Cô Hoa',
  slotCode: 'HC-07',
  aiExtractedLocation: null,
  assist: {
    aiAvailable: true,
    signageText: 'BÁNH MÌ CÔ HOA',
    locationText: null,
    permitVisible: 'NO',
    description: null,
    flags: ['NO_PERMIT_VISIBLE_IN_PHOTO'],
    permitCheck: { permitId: 5, permitStatus: 'ACTIVE', contractStatus: 'ACTIVE', slotCode: 'HC-07', validNow: true, slotMatchesReport: true },
    generatedAt: '2026-10-23T05:01:00Z',
    aiLogId: 77,
    disclaimer: 'Gợi ý của hệ thống chỉ để tham khảo. Cán bộ quyết định xử lý phản ánh.',
  },
  reportType: 'OVERCHARGE',
  dueAt: '2026-11-03T16:59:59Z',
  isOverdue: false,
  vendorId: 9,
  slotId: 7,
  scannedPermitId: 5,
  priceEvidence: {
    menuItemId: 3,
    itemName: 'Bánh mì thịt',
    priceUnit: 'ổ',
    postedUnitPrice: 25_000,
    priceVersion: 4,
    priceVersionAt: '2026-10-20T01:15:00Z',
    quantity: 2,
    postedAmount: 50_000,
    chargedAmount: 70_000,
    difference: 20_000,
    purchasedAt: '2026-10-23T04:30:00Z',
  },
  outcome: null,
  reportsAgainstVendor90Days: 3,
  suggestedViolationType: 'PRICE_ABOVE_POSTED',
  violationId: null,
};

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear()));
function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <WardReportDetailScreen />
    </QueryClientProvider>,
  );
}

let alert: jest.SpyInstance;
/** Presses the confirming button of the native confirmation the screen raised. */
const confirm = (label: string) => (alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[]).find((b) => b.text === label)!.onPress!();

beforeEach(() => {
  api.get.mockReset().mockResolvedValue(pending);
  api.resolve.mockReset();
  (router.push as jest.Mock).mockReset();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => alert.mockRestore());

describe('ward report detail (WARD-19)', () => {
  it('shows the server price evidence, the 90-day count as context and the [AI] reading labelled', async () => {
    await renderDetail();
    expect(await screen.findByText('Bằng chứng giá', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText('25.000 đ × 2 = 50.000 đ')).toBeTruthy();
    expect(screen.getByText('+20.000 đ')).toBeTruthy();
    expect(screen.getByText('Bản số 4, 20/10/2026 08:15')).toBeTruthy();
    expect(screen.getByText('Phản ánh về người bán (90 ngày)')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('[AI] Gợi ý')).toBeTruthy();
    expect(screen.getByText('Chữ trên biển hiệu: BÁNH MÌ CÔ HOA')).toBeTruthy();
    expect(screen.getByText('Không thấy giấy phép trong ảnh')).toBeTruthy();
  });

  it('"Bác" needs a reason; once given, it asks to confirm and sends DISMISSED with the expected status', async () => {
    api.resolve.mockResolvedValue({ ...pending, status: 'DISMISSED', outcome: { resolution: 'DISMISSED', note: 'Giá đúng bảng.', refundAmount: null, reviewedAt: '2026-10-23T06:00:00Z', reviewedByName: 'Trần Cán Bộ' } });
    await renderDetail();
    await fireEvent.press(await screen.findByText('Bác phản ánh', {}, { timeout: 15000 }));
    expect(screen.getByText('Nhập lý do bác. Người phản ánh sẽ đọc lý do này.')).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Lý do bác'), 'Giá đúng bảng.');
    await fireEvent.press(screen.getByText('Bác phản ánh'));
    expect(alert).toHaveBeenCalledWith('Bác phản ánh #41?', expect.any(String), expect.any(Array));
    expect(api.resolve).not.toHaveBeenCalled();
    await confirm('Bác phản ánh');

    await waitFor(() => expect(api.resolve).toHaveBeenCalledWith(41, { expectedStatus: 'PENDING', outcome: 'DISMISSED', note: 'Giá đúng bảng.' }));
    expect(await screen.findByText('Kết quả xử lý')).toBeTruthy();
    expect(screen.queryByText('Bác phản ánh')).toBeNull();
  });

  it('"Đã hòa giải" needs a note and refuses a refund above the amount charged', async () => {
    api.resolve.mockResolvedValue({ ...pending, status: 'REVIEWED', outcome: { resolution: 'MEDIATED', note: 'Đã hoàn chênh lệch.', refundAmount: 20_000, reviewedAt: '2026-10-23T06:00:00Z', reviewedByName: 'Trần Cán Bộ' } });
    await renderDetail();
    await fireEvent.press(await screen.findByText('Đã hòa giải', {}, { timeout: 15000 }));
    await fireEvent.press(screen.getByText('Ghi nhận đã hòa giải'));
    expect(screen.getByText('Nhập ghi chú hòa giải.')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Ghi chú hòa giải'), 'Đã hoàn chênh lệch.');
    await fireEvent.changeText(screen.getByLabelText('Số tiền hoàn cho khách'), '80000');
    await fireEvent.press(screen.getByText('Ghi nhận đã hòa giải'));
    expect(screen.getByText('Không được vượt số tiền khách bị tính (70.000 đ).')).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Hoàn đúng chênh lệch 20.000 đ'));
    await fireEvent.press(screen.getByText('Ghi nhận đã hòa giải'));
    await confirm('Ghi nhận');
    await waitFor(() => expect(api.resolve).toHaveBeenCalledWith(41, { expectedStatus: 'PENDING', outcome: 'MEDIATED', note: 'Đã hoàn chênh lệch.', refundAmount: 20_000 }));
    expect(await screen.findByText('Hoàn cho khách')).toBeTruthy();
  });

  it('"Lập biên bản" opens the existing record form with the report as its source', async () => {
    await renderDetail();
    await fireEvent.press(await screen.findByText('Lập biên bản', {}, { timeout: 15000 }));
    await fireEvent.press(screen.getByText('Mở biên bản vi phạm'));
    expect(router.push).toHaveBeenCalledWith('/ward/patrol/violations/new?sourceReportId=41');
    expect(api.resolve).not.toHaveBeenCalled();
  });

  it('when another officer closed it first (409), reads the report again', async () => {
    api.resolve.mockRejectedValue(new ApiError('conflict', 409, 'Phản ánh đã được cán bộ khác xử lý.'));
    await renderDetail();
    await fireEvent.changeText(await screen.findByLabelText('Lý do bác', {}, { timeout: 15000 }), 'Không đủ căn cứ.');
    await fireEvent.press(screen.getByText('Bác phản ánh'));
    await confirm('Bác phản ánh');
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });
});

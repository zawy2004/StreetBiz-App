import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { communityApi, type PermitVerification } from '@/features/vendor-map/community-api';
import { VendorReportScreen } from '@/features/vendor-reports/screens/ReportFormScreen';
import { useAuthStore, type AppUser } from '@/store/auth-store';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'));
// The native time picker and sheets have no runtime under Jest: a sheet shows its rows while open.
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: () => null }));
jest.mock('@/components/common/Sheet', () => ({
  Sheet: ({ visible, title, children }: { visible: boolean; title: string; children: ReactNode }) => {
    const { Text, View } = jest.requireActual('react-native');
    return visible ? (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    ) : null;
  },
}));
jest.mock('@/components/forms/FileSourceSheet', () => ({ useFilePicker: () => ({ pick: jest.fn(), sheet: null }) }));
jest.mock('@/features/vendor-map/community-api', () => ({
  ...jest.requireActual('@/features/vendor-map/community-api'),
  communityApi: { verifyPermit: jest.fn(), profile: jest.fn(), report: jest.fn(), uploadEvidence: jest.fn() },
}));

const api = communityApi as unknown as Record<'verifyPermit' | 'profile' | 'report' | 'uploadEvidence', jest.Mock>;
const TOKEN = 'SBP1.eyJjIjoxMn0.c2ln';
const buyer: AppUser = { id: '201', fullName: 'Lê Văn Khách', phone: '0905000201', role_code: 'CUSTOMER', account_status: 'ACTIVE' };

const board: PermitVerification = {
  isValid: true,
  status: 'VALID',
  permitId: 5,
  vendorId: 9,
  displayName: 'Bánh mì Cô Hoa',
  slotId: 7,
  slotCode: 'HC-07',
  latitude: null,
  longitude: null,
  validFrom: '2026-09-01',
  validUntil: '2027-08-31',
  priceBoard: {
    version: 4,
    updatedAt: '2026-10-20T01:15:00Z',
    printedVersionIsCurrent: null,
    items: [
      { menuItemId: 3, name: 'Bánh mì thịt', nameEn: 'Pork banh mi', priceUnit: 'ổ', unitPrice: 25_000 },
      { menuItemId: 4, name: 'Cà phê sữa đá', nameEn: null, priceUnit: 'ly', unitPrice: 20_000 },
    ],
  },
};

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear()));
function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <VendorReportScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockReset());
  (router.back as jest.Mock).mockReset();
  (router.push as jest.Mock).mockReset();
  api.profile.mockResolvedValue({ displayName: 'Bánh mì Cô Hoa', slotCode: 'HC-07' });
  api.verifyPermit.mockResolvedValue(board);
  api.report.mockResolvedValue({ reportId: 41, status: 'PENDING', reportType: 'OVERCHARGE', dueAt: '2026-11-03T16:59:59Z', postedAmount: 50_000, chargedAmount: 70_000 });
  mockParams = { vendorId: '9', type: 'OVERCHARGE', permitId: '5', slotId: '7', qr: TOKEN };
  useAuthStore.setState({ user: buyer });
});

async function pickDish(name: string) {
  await fireEvent.press(await screen.findByText('Chọn món trên bảng giá', {}, { timeout: 15000 }));
  await fireEvent.press(screen.getByText(name));
}

describe('complaint form: "Bị tính cao hơn giá niêm yết" (BUY-07)', () => {
  it('asks the server for the board again with the scanned token (BR-39)', async () => {
    await renderForm();
    await screen.findByText('Chọn món trên bảng giá', {}, { timeout: 15000 });
    expect(api.verifyPermit).toHaveBeenCalledWith(TOKEN);
  });

  it('shows posted × quantity and the difference as the buyer types, and blocks an amount not above posted', async () => {
    await renderForm();
    await pickDish('Bánh mì thịt');
    await fireEvent.press(screen.getByLabelText('Tăng số lượng'));
    await fireEvent.changeText(screen.getByLabelText('Số tiền bạn đã trả'), '50000');

    expect(screen.getByText('25.000 đ × 2 ổ')).toBeTruthy();
    expect(screen.getAllByText('50.000 đ').length).toBeGreaterThan(0);
    expect(screen.getByText('Không cao hơn giá niêm yết')).toBeTruthy();
    await fireEvent.press(screen.getByText('Gửi phản ánh'));
    expect(api.report).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Số tiền bạn đã trả'), '70000');
    expect(screen.queryByText('Không cao hơn giá niêm yết')).toBeNull();
    expect(screen.getByText('+20.000 đ')).toBeTruthy();
  });

  it('sends the dish, quantity, amount and purchase time, never a posted price', async () => {
    await renderForm();
    await pickDish('Bánh mì thịt');
    await fireEvent.press(screen.getByLabelText('Tăng số lượng'));
    await fireEvent.changeText(screen.getByLabelText('Số tiền bạn đã trả'), '70000');
    await fireEvent.press(screen.getByText('Gửi phản ánh'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());

    expect(api.report).toHaveBeenCalledTimes(1);
    const [vendorId, body] = api.report.mock.calls[0];
    expect(vendorId).toBe('9');
    expect(body).toEqual({
      reportType: 'OVERCHARGE',
      menuItemId: 3,
      quantity: 2,
      chargedAmount: 70_000,
      purchasedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+07:00$/),
      reason: undefined,
      evidenceUrl: undefined,
      slotId: 7,
      scannedPermitId: 5,
    });
    expect(body).not.toHaveProperty('postedAmount');
  });

  it('without a scanned board, asks the buyer to scan the stall QR first', async () => {
    mockParams = { vendorId: '9', type: 'OVERCHARGE' };
    await renderForm();
    expect(await screen.findByText('Cần bảng giá của quầy', {}, { timeout: 15000 })).toBeTruthy();
    await screen.findByText('Bánh mì Cô Hoa');
    expect(api.verifyPermit).not.toHaveBeenCalled();
  });

  it('a guest is asked to sign in and comes back to this form afterwards', async () => {
    useAuthStore.setState({ user: null });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderForm();
    await pickDish('Bánh mì thịt');
    await fireEvent.changeText(screen.getByLabelText('Số tiền bạn đã trả'), '70000');
    await fireEvent.press(screen.getByText('Gửi phản ánh'));

    expect(api.report).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Cần đăng nhập', expect.any(String), expect.any(Array));
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Đăng nhập')!.onPress!();
    expect(router.push).toHaveBeenCalledWith('/auth/sign-in?back=1');
    alert.mockRestore();
  });
});

describe('complaint form: the other two types', () => {
  it('"Quầy không treo bảng giá" sends with no words required', async () => {
    mockParams = { vendorId: '9', type: 'PRICE_NOT_POSTED', permitId: '5', slotId: '7' };
    api.report.mockResolvedValue({ reportId: 42, status: 'PENDING', reportType: 'PRICE_NOT_POSTED', dueAt: null, postedAmount: null, chargedAmount: null });
    await renderForm();
    await screen.findByText('Bánh mì Cô Hoa', {}, { timeout: 15000 });
    await fireEvent.press(screen.getByText('Gửi phản ánh'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());

    expect(api.report).toHaveBeenCalledWith('9', { reportType: 'PRICE_NOT_POSTED', reason: undefined, evidenceUrl: undefined, slotId: 7, scannedPermitId: 5 });
  });

  it('"Phản ánh khác" needs a description', async () => {
    mockParams = { vendorId: '9' };
    await renderForm();
    await screen.findByText('Bánh mì Cô Hoa', {}, { timeout: 15000 });
    await fireEvent.press(screen.getByText('Gửi phản ánh'));
    expect(screen.getByText('Mô tả điều bạn thấy.')).toBeTruthy();
    expect(api.report).not.toHaveBeenCalled();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { communityApi, type PermitVerification } from '@/features/vendor-map/community-api';
import { VerdictPriceBoard } from '@/features/vendor-map/components/PriceBoardPanel';
import { PublicScanScreen } from '@/features/vendor-map/screens/CommunityScreens';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
// No camera under Jest: the permission is not granted yet, so the paste box is the way in.
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: false, canAskAgain: true }, jest.fn()],
}));
jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('@/components/map/LeafletMap', () => ({ LeafletMap: () => null }));
// Where the buyer stands is optional; here the phone says nothing.
jest.mock('@/features/buyer-discovery/geolocation', () => ({ detectPosition: jest.fn().mockRejectedValue(new Error('no fix')) }));
jest.mock('@/features/vendor-map/community-api', () => ({
  ...jest.requireActual('@/features/vendor-map/community-api'),
  communityApi: { verifyPermit: jest.fn(), profile: jest.fn() },
}));

const verifyPermit = communityApi.verifyPermit as jest.Mock;
const push = router.push as jest.Mock;
const TOKEN = 'SBP1.eyJjIjoxMn0.c2ln';

const valid = (overrides: Partial<PermitVerification> = {}): PermitVerification => ({
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
    printedVersionIsCurrent: false,
    items: [
      { menuItemId: 3, name: 'Bánh mì thịt', nameEn: 'Pork banh mi', priceUnit: 'ổ', unitPrice: 25_000 },
      { menuItemId: 4, name: 'Cà phê sữa đá', nameEn: null, priceUnit: 'ly', unitPrice: 20_000 },
    ],
  },
  ...overrides,
});

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear()));
function renderScan() {
  // No garbage-collection timers (gcTime Infinity), so nothing outlives the test.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <PublicScanScreen />
    </QueryClientProvider>,
  );
}

async function check(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Hoặc dán mã giấy phép'), text);
  await fireEvent.press(screen.getByText('Kiểm tra'));
}

beforeEach(() => {
  verifyPermit.mockReset();
  push.mockReset();
});

describe('buyer scanner: the printed board link and the price board (BUY-06, BR-39)', () => {
  it('sends the token and the printed version out of a pasted /q/ link, then shows the live board', async () => {
    verifyPermit.mockResolvedValue(valid());
    await renderScan();
    await check(`http://192.168.1.10:5173/q/${TOKEN}?v=3`);

    expect(await screen.findByText('Bảng giá niêm yết', {}, { timeout: 15000 })).toBeTruthy();
    expect(verifyPermit).toHaveBeenCalledWith(TOKEN, undefined, 3);
    expect(screen.getByText('Bánh mì thịt')).toBeTruthy();
    expect(screen.getByText('Pork banh mi')).toBeTruthy();
    expect(screen.getByText('25.000 đ')).toBeTruthy();
    expect(screen.getByText('/ ổ')).toBeTruthy();
    expect(screen.getByText('/ ly')).toBeTruthy();
    expect(screen.getByText('Bản số 4')).toBeTruthy();
    expect(screen.getByText('Cập nhật lúc 20/10/2026 08:15')).toBeTruthy();
    expect(screen.getByText('Bảng giá tại quầy là bản 3, giá hiện tại là bản 4.')).toBeTruthy();
  });

  it('offers the three reports and the city 1022 channel; the overcharge form gets ids and the token, never the board', async () => {
    verifyPermit.mockResolvedValue(valid());
    await renderScan();
    await check(`https://sb.example/q/${TOKEN}?v=4`);
    await screen.findByText('Bảng giá niêm yết', {}, { timeout: 15000 });

    expect(screen.getByText('Quầy không treo bảng giá')).toBeTruthy();
    expect(screen.getByText('Phản ánh khác')).toBeTruthy();
    expect(screen.getByText('Gọi (0236) 1022')).toBeTruthy();
    expect(screen.getByText('gopy.danang.gov.vn')).toBeTruthy();

    await fireEvent.press(screen.getByText('Bị tính cao hơn giá niêm yết'));
    expect(push).toHaveBeenCalledWith(`/customer/explore/vendors/9/report?type=OVERCHARGE&permitId=5&slotId=7&qr=${encodeURIComponent(TOKEN)}&v=4`);
  });

  it('still reads the bare token of an older QR', async () => {
    verifyPermit.mockResolvedValue(valid({ priceBoard: { version: 4, updatedAt: null, printedVersionIsCurrent: null, items: [] } }));
    await renderScan();
    await check(TOKEN);

    expect(await screen.findByText('Quầy chưa niêm yết món nào trên StreetBiz.', {}, { timeout: 15000 })).toBeTruthy();
    expect(verifyPermit).toHaveBeenCalledWith(TOKEN, undefined, null);
    expect(screen.queryByText(/Bảng giá tại quầy là bản/)).toBeNull();
  });

  it('an invalid permit shows no prices at all, only the warning and the way to report', async () => {
    verifyPermit.mockResolvedValue(valid({ isValid: false, status: 'SUSPENDED' }));
    await renderScan();
    await check(TOKEN);

    expect(await screen.findByText('Phản ánh tới Phường', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.queryByText('Bảng giá niêm yết')).toBeNull();
    expect(screen.queryByText('Bánh mì thịt')).toBeNull();
    expect(screen.getByText('Gọi (0236) 1022')).toBeTruthy();
  });

  it('asks the server again for every check: nothing is kept between scans', async () => {
    verifyPermit.mockResolvedValue(valid());
    await renderScan();
    await check(TOKEN);
    await screen.findByText('Bảng giá niêm yết', {}, { timeout: 15000 });
    await fireEvent.press(screen.getByText('Quét mã khác'));
    await check(TOKEN);
    await screen.findByText('Bảng giá niêm yết', {}, { timeout: 15000 });

    expect(verifyPermit).toHaveBeenCalledTimes(2);
  });
});

describe('VerdictPriceBoard', () => {
  it('says nothing about the paper board when the scan carried no version or the version is current', async () => {
    await render(<VerdictPriceBoard result={valid({ priceBoard: { ...valid().priceBoard!, printedVersionIsCurrent: null } })} printedVersion={null} />);
    expect(screen.queryByText(/Bảng giá tại quầy là bản/)).toBeNull();
    await render(<VerdictPriceBoard result={valid({ priceBoard: { ...valid().priceBoard!, printedVersionIsCurrent: true } })} printedVersion={4} />);
    expect(screen.queryByText(/Bảng giá tại quầy là bản/)).toBeNull();
  });

  it('tells a valid stall without a board that the paper board is still required', async () => {
    await render(<VerdictPriceBoard result={valid({ priceBoard: null })} printedVersion={null} />);
    expect(screen.getByText('Quầy chưa đăng bảng giá trên StreetBiz')).toBeTruthy();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PermitScanScreen } from '@/features/ward-administration/screens/PatrolScreens';
import { complianceApi, type InspectPermitResult } from '@/features/ward-administration/ward-api';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: false, canAskAgain: true }, jest.fn()],
}));
jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('@/components/forms/FileSourceSheet', () => ({ useFilePicker: () => ({ pick: jest.fn(), sheet: null }) }));
jest.mock('@/features/buyer-discovery/geolocation', () => ({ detectPosition: jest.fn().mockRejectedValue(new Error('no fix')) }));
jest.mock('@/features/ward-administration/ward-api', () => ({
  ...jest.requireActual('@/features/ward-administration/ward-api'),
  complianceApi: { inspectPermit: jest.fn(), uploadEvidence: jest.fn(), geofenceDrift: jest.fn() },
}));

const api = complianceApi as unknown as Record<'inspectPermit' | 'geofenceDrift', jest.Mock>;
const TOKEN = 'SBP1.eyJjIjoxMn0.c2ln';

const found: InspectPermitResult = {
  found: true,
  isValid: true,
  effectiveStatus: 'VALID',
  permitId: 5,
  contractId: 12,
  vendorId: 9,
  vendorName: 'Bánh mì Cô Hoa',
  slotId: 7,
  slotCode: 'HC-07',
  slotStreet: 'Bạch Đằng',
  width: 1.5,
  length: 2,
  startDate: '2026-09-01',
  endDate: '2027-08-31',
  distanceMeters: null,
  isLocationMatched: true,
  locationWarning: null,
  aiVisionResult: null,
  isOwnWard: true,
};

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear()));

beforeEach(() => {
  api.inspectPermit.mockReset().mockResolvedValue(found);
  api.geofenceDrift.mockReset().mockResolvedValue({ windowDays: 30, toleranceMeters: 25, items: [] });
});

describe("officer's patrol scanner reads the printed price-board link (WARD-11)", () => {
  it.each([
    [`http://192.168.1.10:5173/q/${TOKEN}?v=2`, TOKEN],
    [TOKEN, TOKEN],
    ['SB-HC1-2026-0815', 'SB-HC1-2026-0815'],
  ])('%s is inspected as %s', async (pasted, sent) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
    clients.push(client);
    await render(
      <QueryClientProvider client={client}>
        <PermitScanScreen />
      </QueryClientProvider>,
    );
    await fireEvent.changeText(screen.getByLabelText('Hoặc nhập mã in trên giấy phép'), pasted);
    await fireEvent.press(screen.getByText('Kiểm tra'));

    await waitFor(() => expect(api.inspectPermit).toHaveBeenCalled());
    expect(api.inspectPermit.mock.calls[0]![0]).toBe(sent);
    expect(await screen.findByText('Bánh mì Cô Hoa', {}, { timeout: 15000 })).toBeTruthy();
  });
});

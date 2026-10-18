import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { sideApi, type DigitalPermit, type RentalContract } from '@/core/api/side-api';
import { DigitalPermitScreen } from '@/features/digital-permits/screens/DigitalPermitScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}));
// The QR drawing is an SVG; what matters here is the verdict and the code printed under it.
jest.mock('@/components/common/PermitQr', () => ({ PermitQr: () => null }));
jest.mock('@/core/api/side-api', () => ({
  ...jest.requireActual('@/core/api/side-api'),
  sideApi: { getPermit: jest.fn(), getContract: jest.fn() },
}));

const getPermit = sideApi.getPermit as jest.Mock;
const getContract = sideApi.getContract as jest.Mock;

const contract: RentalContract = {
  contractId: 12,
  applicationId: 3,
  slotId: 7,
  slotCode: 'A-07',
  zoneName: 'Bạch Đằng',
  startDate: '2026-09-01',
  endDate: '2027-08-31',
  contractStatus: 'ACTIVE',
  cancellationReason: null,
  cancelledAt: null,
  createdAt: '2026-08-30T03:00:00Z',
  updatedAt: null,
};
const permit = (effectiveStatus: string, contractStatus = 'ACTIVE'): DigitalPermit => ({
  permitId: 5,
  contractId: 12,
  qrPayload: 'SBP1.signed-payload',
  startDate: '2026-09-01',
  endDate: '2027-08-31',
  permitStatus: 'ACTIVE',
  contractStatus,
  effectiveStatus,
});

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderScreen(client = newClient()) {
  return render(
    <QueryClientProvider client={client}>
      <DigitalPermitScreen contractId={12} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getPermit.mockReset();
  getContract.mockReset().mockResolvedValue(contract);
});

describe('DigitalPermitScreen (live server reads)', () => {
  it('shows a valid permit with the code to show the ward officer', async () => {
    getPermit.mockResolvedValue(permit('VALID'));
    await renderScreen();

    expect(await screen.findByText('Đưa mã này cho cán bộ phường quét.', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText('SBP1.signed-payload')).toBeTruthy();
    expect(screen.getByText(/^Kiểm tra với máy chủ lúc /)).toBeTruthy();
    expect(getPermit).toHaveBeenCalledWith(12);
  });

  it('says a suspended permit is not valid, in words and with the contract state', async () => {
    getPermit.mockResolvedValue(permit('SUSPENDED', 'SUSPENDED'));
    await renderScreen();

    expect(await screen.findByText('Giấy phép này hiện không có hiệu lực.', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText(/^Hợp đồng: /)).toBeTruthy();
  });

  it('shows the error with a retry when the server cannot be reached', async () => {
    getPermit.mockRejectedValue(new Error('Không kết nối được máy chủ.'));
    await renderScreen();

    expect(await screen.findByText('Chưa xác minh được giấy phép', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText('Thử lại')).toBeTruthy();
  });

  it('BR-39: asks the server again on every open, never reusing a cached permit', async () => {
    getPermit.mockResolvedValue(permit('VALID'));
    const client = newClient();
    const first = await renderScreen(client);
    await screen.findByText('SBP1.signed-payload', {}, { timeout: 15000 });
    first.unmount();
    await renderScreen(client);
    await screen.findByText('SBP1.signed-payload', {}, { timeout: 15000 });

    expect(getPermit).toHaveBeenCalledTimes(2);
  });
});

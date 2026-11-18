import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { financeApi, type VendorWardPenaltyScheduleDto } from '@/core/api/finance-api';
import { PenaltyRateBook, VendorViolationsScreen } from '@/features/fee-schedules/screens/LedgerScreens';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('@/core/api/finance-api', () => ({
  ...jest.requireActual('@/core/api/finance-api'),
  financeApi: { violations: jest.fn(), penaltySchedules: jest.fn() },
}));

const api = financeApi as unknown as Record<'violations' | 'penaltySchedules', jest.Mock>;

const haiChau: VendorWardPenaltyScheduleDto = {
  wardUnitId: 7,
  wardName: 'Phường Hải Châu',
  rates: [
    { violationType: 'OUTSIDE_SLOT', violationTypeName: 'Bán ngoài ô được thuê', penaltyAmount: 500_000, legalBasis: 'Nghị định 123/2021/NĐ-CP' },
    { violationType: 'NO_PERMIT', violationTypeName: 'Không treo giấy phép', penaltyAmount: 1_500_000, legalBasis: null },
  ],
};

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear()));

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <VendorViolationsScreen />
    </QueryClientProvider>,
  );
}

describe('Mức phạt của phường', () => {
  it('lists each violation with its amount and legal basis', async () => {
    await render(<PenaltyRateBook wards={[haiChau]} />);

    expect(screen.getByText('Phường Hải Châu')).toBeTruthy();
    expect(screen.getByLabelText('Bán ngoài ô được thuê: 500.000 đ')).toBeTruthy();
    expect(screen.getByLabelText('Không treo giấy phép: 1.500.000 đ')).toBeTruthy();
    expect(screen.getByText('Nghị định 123/2021/NĐ-CP')).toBeTruthy();
  });

  it('says so when the ward has published no rate', async () => {
    await render(<PenaltyRateBook wards={[]} />);

    expect(screen.getByText('Phường của bạn chưa công bố mức phạt nào.')).toBeTruthy();
  });

  it('is on the violation history even before any notice', async () => {
    api.violations.mockResolvedValue([]);
    api.penaltySchedules.mockResolvedValue([haiChau]);
    await mount();

    expect(await screen.findByText('Chưa có vi phạm nào')).toBeTruthy();
    expect(await screen.findByLabelText('Bán ngoài ô được thuê: 500.000 đ')).toBeTruthy();
  });
});

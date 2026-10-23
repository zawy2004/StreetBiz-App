import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import QRCode from 'react-native-qrcode-svg';

import { PermitQr } from '@/components/common/PermitQr';
import { sellerStoreApi, type SellerMenuItem, type SellerPriceBoard } from '@/core/api/seller-store-api';
import { historyLine } from '@/features/storefronts/price-board-view';
import { DishEditScreen, MenuScreen } from '@/features/storefronts/screens/MenuScreens';
import { PriceBoardScreen } from '@/features/storefronts/screens/PriceBoardScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), canGoBack: () => true },
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ storefrontId: '1', id: '3' }),
}));
jest.mock('@react-native-community/netinfo', () => jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('@/components/forms/FileSourceSheet', () => ({ useFilePicker: () => ({ pick: jest.fn(), sheet: null }) }));
jest.mock('react-native-qrcode-svg', () => ({ __esModule: true, default: jest.fn(() => null) }));
jest.mock('@/core/api/seller-store-api', () => ({
  ...jest.requireActual('@/core/api/seller-store-api'),
  sellerStoreApi: { stores: jest.fn(), categories: jest.fn(), menu: jest.fn(), priceBoard: jest.fn(), saveItem: jest.fn(), uploadMenuImage: jest.fn() },
}));

const api = sellerStoreApi as unknown as Record<'stores' | 'categories' | 'menu' | 'priceBoard' | 'saveItem', jest.Mock>;

const dish: SellerMenuItem = {
  menuItemId: 3,
  storefrontId: 1,
  categoryId: 2,
  name: 'Cà phê sữa đá',
  description: null,
  unitPrice: 25_000,
  availabilityStatus: 'AVAILABLE',
  imageUrl: null,
  categoryName: 'Đồ uống',
  requiresFoodSafety: false,
  foodSafetyStatus: 'NOT_REQUIRED',
  foodSafetyExpiresOn: null,
  nameEn: 'Iced milk coffee',
  priceUnit: 'ly',
};
const board: SellerPriceBoard = {
  storefrontId: 1,
  storefrontName: 'Cà phê Cô Hoa',
  slotCode: 'HC-07',
  version: 2,
  updatedAt: '2026-10-20T01:15:00Z',
  qrUrl: null,
  printUrl: null,
  items: [],
  boards: [],
  history: [
    { priceHistoryId: 12, menuItemId: 3, name: 'Cà phê sữa đá', nameEn: null, priceUnit: 'ly', unitPrice: 25_000, previousUnitPrice: 20_000, isListed: true, changeKind: 'UPDATED', changedAt: '2026-10-20T01:15:00Z', changedByName: 'Nguyễn Thị Hoa' },
    { priceHistoryId: 11, menuItemId: 3, name: 'Cà phê sữa đá', nameEn: null, priceUnit: 'ly', unitPrice: 20_000, previousUnitPrice: null, isListed: true, changeKind: 'CREATED', changedAt: '2026-10-01T01:00:00Z', changedByName: 'Nguyễn Thị Hoa' },
  ],
};

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear()));
function renderWith(node: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockReset());
  api.stores.mockResolvedValue([{ storefrontId: 1, registrationId: 1, contractId: 1, name: 'Cà phê Cô Hoa', description: null, availabilityStatus: 'OPEN' }]);
  api.categories.mockResolvedValue([{ categoryId: 2, name: 'Đồ uống', requiresFoodSafety: false }]);
  api.menu.mockResolvedValue({ items: [dish], maxItems: 5 });
  api.priceBoard.mockResolvedValue(board);
  api.saveItem.mockResolvedValue(dish);
});

describe('dish form: the unit is required, the English name optional (BUY-06)', () => {
  it('will not save a dish without its unit', async () => {
    await renderWith(<DishEditScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Đơn vị tính', {}, { timeout: 15000 }), '  ');
    await fireEvent.press(screen.getByText('Lưu thay đổi'));

    expect(screen.getByText('Nhập đơn vị tính, ví dụ ổ, ly, tô.')).toBeTruthy();
    expect(api.saveItem).not.toHaveBeenCalled();
  });

  it('sends the unit and the English name with the dish', async () => {
    await renderWith(<DishEditScreen />);
    await fireEvent.press(await screen.findByText('tô', {}, { timeout: 15000 }));
    await fireEvent.changeText(screen.getByLabelText('Tên tiếng Anh'), '  Iced coffee ');
    await fireEvent.press(screen.getByText('Lưu thay đổi'));

    await waitFor(() => expect(api.saveItem).toHaveBeenCalled());
    expect(api.saveItem).toHaveBeenCalledWith(1, 3, {
      categoryId: 2,
      name: 'Cà phê sữa đá',
      description: null,
      unitPrice: 25_000,
      availabilityStatus: 'AVAILABLE',
      priceUnit: 'tô',
      nameEn: 'Iced coffee',
    });
  });

  it("shows this dish's latest price changes", async () => {
    await renderWith(<DishEditScreen />);
    expect(await screen.findByText('Lịch sử giá món này', {}, { timeout: 15000 })).toBeTruthy();
    expect(screen.getByText('20.000 đ → 25.000 đ / ly')).toBeTruthy();
    expect(screen.getByText('Thêm món')).toBeTruthy();
  });

  it('the sold-out switch keeps the unit and English name (the API refuses a dish without its unit)', async () => {
    await renderWith(<MenuScreen />);
    await fireEvent(await screen.findByLabelText('Đánh dấu hết món', {}, { timeout: 15000 }), 'valueChange', false);
    await waitFor(() => expect(api.saveItem).toHaveBeenCalled());
    expect(api.saveItem.mock.calls[0]![2]).toEqual(expect.objectContaining({ availabilityStatus: 'SOLD_OUT', priceUnit: 'ly', nameEn: 'Iced milk coffee' }));
  });
});

describe('price history lines', () => {
  it('names each change in the vendor’s words', () => {
    expect(historyLine(board.history[0]!)).toEqual({ title: 'Đổi giá', price: '20.000 đ → 25.000 đ / ly' });
    expect(historyLine(board.history[1]!)).toEqual({ title: 'Thêm món', price: '20.000 đ / ly' });
    expect(historyLine({ ...board.history[0]!, previousUnitPrice: 25_000 }).title).toBe('Sửa tên hoặc đơn vị');
    expect(historyLine({ ...board.history[0]!, changeKind: 'ARCHIVED' }).title).toBe('Gỡ khỏi bảng giá');
  });
});

describe('PermitQr', () => {
  const drawn = QRCode as unknown as jest.Mock;
  beforeEach(() => drawn.mockClear());

  it('draws the public /q/ link when the server gives one', async () => {
    await render(<PermitQr value="SBP1.abc" url="https://sb.example/q/SBP1.abc" size={120} />);
    expect(drawn.mock.calls[0]![0]).toEqual(expect.objectContaining({ value: 'https://sb.example/q/SBP1.abc' }));
  });

  it('draws the bare token as before when there is no link', async () => {
    await render(<PermitQr value="SBP1.abc" url={null} size={120} />);
    expect(drawn.mock.calls[0]![0]).toEqual(expect.objectContaining({ value: 'SBP1.abc' }));
  });

  it('a business with two slots shows and prints each slot its own board', async () => {
    const boards = [
      { permitId: 1, contractId: 1, slotCode: 'HC-07', qrUrl: 'http://h/q/SBP1.a.b?v=2', printUrl: 'http://h/q/SBP1.a.b/print' },
      { permitId: 4, contractId: 9, slotCode: 'HC-03', qrUrl: 'http://h/q/SBP1.c.d?v=2', printUrl: 'http://h/q/SBP1.c.d/print' },
    ];
    api.priceBoard.mockResolvedValue({ ...board, items: [{ menuItemId: 3, name: 'Cà phê sữa đá', nameEn: null, priceUnit: 'ly', unitPrice: 25_000 }], qrUrl: boards[0]!.qrUrl, printUrl: boards[0]!.printUrl, boards });
    const { Linking } = jest.requireActual<typeof import('react-native')>('react-native');
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderWith(<PriceBoardScreen />);

    await waitFor(() => expect(screen.getByText('In bảng ô HC-07')).toBeTruthy());
    expect(drawn.mock.calls.at(-1)![0]).toEqual(expect.objectContaining({ value: 'http://h/q/SBP1.a.b?v=2' }));

    await fireEvent.press(screen.getByText('Ô HC-03'));
    await fireEvent.press(screen.getByText('In bảng ô HC-03'));

    expect(drawn.mock.calls.at(-1)![0]).toEqual(expect.objectContaining({ value: 'http://h/q/SBP1.c.d?v=2' }));
    expect(open).toHaveBeenCalledWith('http://h/q/SBP1.c.d/print');
  });
});

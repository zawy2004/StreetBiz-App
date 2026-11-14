import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactElement } from 'react';

import { sellerStoreApi, type SellerStore } from '@/core/api/seller-store-api';
import { env } from '@/core/config/env';
import { StoreEditScreen } from '@/features/storefronts/screens/StoreScreens';
import { useAuthStore } from '@/store/auth-store';

const mockPick = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
    canGoBack: () => true,
  },
  Stack: { Screen: () => null },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ id: '1' }),
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'),
);
jest.mock('@/components/forms/FileSourceSheet', () => ({
  useFilePicker: () => ({ pick: mockPick, sheet: null }),
}));
jest.mock('@/core/api/seller-store-api', () => ({
  ...jest.requireActual('@/core/api/seller-store-api'),
  sellerStoreApi: {
    stores: jest.fn(),
    contracts: jest.fn(),
    applications: jest.fn(),
    saveStore: jest.fn(),
    uploadMenuImage: jest.fn(),
  },
}));

const api = sellerStoreApi as unknown as Record<
  'stores' | 'contracts' | 'applications' | 'saveStore' | 'uploadMenuImage',
  jest.Mock
>;

const store: SellerStore = {
  storefrontId: 1,
  registrationId: 1,
  contractId: 1,
  name: 'Cà phê Cô Hoa',
  description: null,
  availabilityStatus: 'OPEN',
};

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear()));
function renderWith(node: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockReset());
  mockPick.mockReset();
  api.contracts.mockResolvedValue([]);
  api.applications.mockResolvedValue([]);
  api.saveStore.mockResolvedValue(store);
});

describe('stall photo on the store editor', () => {
  it('uploads a picked photo on save and sends its URL with the store', async () => {
    api.stores.mockResolvedValue([store]);
    api.uploadMenuImage.mockResolvedValue({ fileUrl: '/api/uploads/menu-images/5/abc.jpg' });
    const photo = { uri: 'file:///stall.jpg', name: 'stall.jpg', type: 'image/jpeg', size: 1000 };
    mockPick.mockResolvedValue(photo);
    await renderWith(<StoreEditScreen />);

    await fireEvent.press(
      await screen.findByLabelText('Thêm ảnh gian hàng', {}, { timeout: 15000 }),
    );
    await screen.findByLabelText('Đổi ảnh gian hàng');
    await fireEvent.press(screen.getByText('Lưu gian hàng'));

    await waitFor(() => expect(api.uploadMenuImage).toHaveBeenCalledWith(photo));
    await waitFor(() =>
      expect(api.saveStore).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ imageUrl: '/api/uploads/menu-images/5/abc.jpg' }),
      ),
    );
  });

  it('removes the current photo with an empty imageUrl and keeps it when untouched', async () => {
    api.stores.mockResolvedValue([{ ...store, imageUrl: '/api/uploads/menu-images/5/old.jpg' }]);
    await renderWith(<StoreEditScreen />);

    await fireEvent.press(await screen.findByText('Lưu gian hàng', {}, { timeout: 15000 }));
    await waitFor(() => expect(api.saveStore).toHaveBeenCalledTimes(1));
    expect(api.saveStore.mock.calls[0][1]).not.toHaveProperty('imageUrl');

    await fireEvent.press(screen.getByText('Gỡ ảnh'));
    await fireEvent.press(screen.getByText('Lưu gian hàng'));
    await waitFor(() =>
      expect(api.saveStore).toHaveBeenLastCalledWith(1, expect.objectContaining({ imageUrl: '' })),
    );
    expect(api.uploadMenuImage).not.toHaveBeenCalled();
  });

  it('refuses a photo over 5 MB without uploading it', async () => {
    api.stores.mockResolvedValue([store]);
    mockPick.mockResolvedValue({
      uri: 'file:///big.jpg',
      name: 'big.jpg',
      type: 'image/jpeg',
      size: 6 * 1024 * 1024,
    });
    await renderWith(<StoreEditScreen />);

    await fireEvent.press(
      await screen.findByLabelText('Thêm ảnh gian hàng', {}, { timeout: 15000 }),
    );

    expect(await screen.findByText('Ảnh lớn hơn 5 MB. Chọn ảnh nhỏ hơn.')).toBeTruthy();
    expect(api.uploadMenuImage).not.toHaveBeenCalled();
  });
});

describe('profile photo in the session', () => {
  it('keeps the absolute avatar URL on the user and in the keystore, and clears it', () => {
    useAuthStore.setState({
      user: {
        id: '5',
        fullName: 'Hoa',
        phone: '0905000101',
        role_code: 'VENDOR',
        account_status: 'ACTIVE',
      },
    });

    useAuthStore.getState().setAvatarUrl('/api/uploads/avatars/5/abc.jpg');

    const host = env.apiBaseUrl.replace(/\/$/, '').replace(/\/api$/, '');
    expect(useAuthStore.getState().user?.avatarUrl).toBe(`${host}/api/uploads/avatars/5/abc.jpg`);
    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(
      'streetbiz-user',
      expect.stringContaining('/api/uploads/avatars/5/abc.jpg'),
    );

    useAuthStore.getState().setAvatarUrl(null);
    expect(useAuthStore.getState().user?.avatarUrl).toBeUndefined();
  });
});

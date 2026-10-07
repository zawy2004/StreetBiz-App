import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

/** The real route tree; renderRouter resolves it from the project root (jest's cwd). */
const APP = './src/app';

const signInAs = (phone: string) => {
  const user = useMockDb.getState().users.find((u) => u.phone === phone) ?? null;
  useAuthStore.setState({ user });
};

/**
 * renderRouter hands back RNTL 14's async render promise with the router
 * helpers attached; await the render, then return the helpers in a plain
 * object (returning the thenable itself would unwrap it).
 */
async function open(initialUrl: string) {
  const rendered = renderRouter(APP, { initialUrl });
  await rendered;
  return { getPathname: () => rendered.getPathname(), getSearchParams: () => rendered.getSearchParams() };
}

describe('guest flow', () => {
  beforeEach(() => useAuthStore.setState({ user: null }));

  it('lands a signed-out visitor on the welcome screen', async () => {
    const router = await open('/');
    await waitFor(() => expect(router.getPathname()).toBe('/welcome'));
    expect(await screen.findByText('Tìm quán quanh đây')).toBeTruthy();
  });

  it('lets a guest browse Explore without the buyer-only tabs', async () => {
    const router = await open('/customer/explore');
    await waitFor(() => expect(router.getPathname()).toBe('/customer/explore'));
    expect(await screen.findByText('Hôm nay ăn gì trên phố?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeTruthy();
    expect(screen.queryByText('Đơn hàng')).toBeNull();
    expect(screen.queryByText('Tin nhắn')).toBeNull();
  });

  it('sends a guest to sign-in, remembering the page, for members-only screens', async () => {
    const router = await open('/customer/checkout');
    await waitFor(() => expect(router.getPathname()).toBe('/sign-in'));
    expect(router.getSearchParams()).toMatchObject({ next: '/customer/checkout' });
  });

  it('keeps guests out of the seller area', async () => {
    const router = await open('/vendor/home');
    await waitFor(() => expect(router.getPathname()).toBe('/welcome'));
  });
});

describe('signing in', () => {
  beforeEach(() => useAuthStore.setState({ user: null }));

  it('returns to the page the guest was heading to', async () => {
    const router = await open('/sign-in?next=%2Fcustomer%2Forders');
    await fireEvent.press(await screen.findByRole('button', { name: 'Đăng nhập demo: Người mua' }));
    await waitFor(() => expect(router.getPathname()).toBe('/customer/orders'));
  });

  it('ignores a destination outside the role area', async () => {
    const router = await open('/sign-in?next=%2Fcustomer%2Forders');
    await fireEvent.press(await screen.findByRole('button', { name: 'Đăng nhập demo: Hộ kinh doanh' }));
    await waitFor(() => expect(router.getPathname()).toBe('/vendor/home'));
  });
});

describe('signed-in flows', () => {
  it('opens the buyer shell with orders and messages for a customer', async () => {
    signInAs('0905000001');
    const router = await open('/');
    await waitFor(() => expect(router.getPathname()).toBe('/customer/explore'));
    expect(await screen.findByText('Đơn hàng')).toBeTruthy();
    expect(screen.getByText('Tin nhắn')).toBeTruthy();
  });

  it('opens the seller shell for a vendor, with a messages tab', async () => {
    signInAs('0905000002');
    const router = await open('/');
    await waitFor(() => expect(router.getPathname()).toBe('/vendor/home'));
    expect(await screen.findByText('Tin nhắn')).toBeTruthy();
  });

  it('sends each role back to its own area', async () => {
    signInAs('0905000001');
    const buyer = await open('/vendor/home');
    await waitFor(() => expect(buyer.getPathname()).toBe('/customer/explore'));
    screen.unmount();

    signInAs('0905000002');
    const seller = await open('/customer/explore');
    await waitFor(() => expect(seller.getPathname()).toBe('/vendor/home'));
  });
});

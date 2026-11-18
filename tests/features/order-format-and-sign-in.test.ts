import { router } from 'expo-router';

import { ROLE_HOME_ROUTE } from '@/core/auth/role-routes';
import { leaveSignIn, signInHref } from '@/features/authentication/sign-in-return';
import {
  formatOrderTime,
  formatWait,
  minutesSince,
  ticketItemsShown,
  waitTone,
} from '@/features/orders/components/order-format';

jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissAll: jest.fn() },
}));

const mockedRouter = router as unknown as Record<
  'canGoBack' | 'back' | 'replace' | 'dismissAll',
  jest.Mock
>;

describe('order format (seller tickets)', () => {
  it('shows the clock time in Vietnam', () => {
    expect(formatOrderTime('2026-11-14T11:48:00Z')).toBe('18:48');
  });

  it('counts whole minutes waited and never goes negative', () => {
    const now = Date.parse('2026-11-14T12:00:00Z');
    expect(minutesSince('2026-11-14T11:47:30Z', now)).toBe(12);
    expect(minutesSince('2026-11-14T12:05:00Z', now)).toBe(0);
  });

  it.each([
    [0, 'vừa xong'],
    [12, '12 phút'],
    [60, '1 giờ'],
    [125, '2 giờ 5 phút'],
    [3 * 24 * 60 + 10, '3 ngày'],
  ])('formats %i minutes as "%s"', (minutes, text) => {
    expect(formatWait(minutes)).toBe(text);
  });

  it('turns a waiting order warn at 5 minutes and late at 10', () => {
    expect(waitTone(4)).toBe('calm');
    expect(waitTone(5)).toBe('warn');
    expect(waitTone(10)).toBe('late');
  });

  it('folds long tickets but never hides a single item', () => {
    expect(ticketItemsShown(3)).toBe(3);
    expect(ticketItemsShown(5)).toBe(5);
    expect(ticketItemsShown(6)).toBe(4);
  });
});

describe('role routes and leaving sign-in', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has a home route for every role', () => {
    expect(ROLE_HOME_ROUTE).toEqual({
      CUSTOMER: '/customer/explore',
      VENDOR: '/vendor/home',
      WARD_AUTHORITY: '/ward/dashboard',
      PLATFORM_ADMIN: '/platform/dashboard',
    });
  });

  it('marks the sign-in link when the buyer should come back to the form', () => {
    expect(signInHref(true)).toBe('/auth/sign-in?back=1');
    expect(signInHref(false)).toBe('/auth/sign-in');
  });

  it('sends a buyer who came from a form back to it', () => {
    mockedRouter.canGoBack.mockReturnValue(true);
    leaveSignIn('CUSTOMER', true);
    expect(mockedRouter.back).toHaveBeenCalledTimes(1);
    expect(mockedRouter.replace).not.toHaveBeenCalled();
  });

  it('sends every other sign-in to the role home, closing the OTP screen when nested', () => {
    mockedRouter.canGoBack.mockReturnValue(true);
    leaveSignIn('VENDOR', true, true);
    expect(mockedRouter.dismissAll).toHaveBeenCalledTimes(1);
    expect(mockedRouter.back).not.toHaveBeenCalled();
    expect(mockedRouter.replace).toHaveBeenCalledWith('/vendor/home');

    mockedRouter.canGoBack.mockReturnValue(false);
    leaveSignIn('CUSTOMER', true);
    expect(mockedRouter.replace).toHaveBeenLastCalledWith('/customer/explore');
  });
});

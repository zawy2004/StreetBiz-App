import type { RoleCode } from '@/core/types/role';

/** Top-level route group each role lives in (mirrors StreetBiz-FE's RoleShell subtrees). */
export type RoleArea = 'customer' | 'vendor' | 'ward';

// Platform admins have no mobile console yet (StreetBiz-FE only), so they browse as a buyer.
export const ROLE_AREA: Record<RoleCode, RoleArea> = {
  CUSTOMER: 'customer',
  VENDOR: 'vendor',
  WARD_AUTHORITY: 'ward',
  PLATFORM_ADMIN: 'customer',
};

export const ROLE_HOME: Record<RoleCode, string> = {
  CUSTOMER: '/customer/explore',
  VENDOR: '/vendor/home',
  WARD_AUTHORITY: '/ward/patrol',
  PLATFORM_ADMIN: '/customer/explore',
};

/** Public front door for signed-out visitors (StreetBiz-FE's LandingScreen at `/`). */
export const WELCOME_ROUTE = '/welcome';
/** Where "browse without an account" lands: the buyer explore tab, read-only. */
export const GUEST_HOME_ROUTE = '/customer/explore';
export const SIGN_IN_ROUTE = '/(auth)/sign-in';

export const signInHref = (next?: string) => (next ? `${SIGN_IN_ROUTE}?next=${encodeURIComponent(next)}` : SIGN_IN_ROUTE);

/**
 * Where to go after signing in: back to what the guest was trying to open when
 * it belongs to this role's area, otherwise the role's home.
 */
export function landingFor(role: RoleCode, next?: string) {
  if (next && next.startsWith(`/${ROLE_AREA[role]}/`)) return next;
  return ROLE_HOME[role];
}

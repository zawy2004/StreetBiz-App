import type { RoleCode } from '@/core/types/role';

/** Landing route for each role right after sign-in / app launch. */
export const ROLE_HOME_ROUTE: Record<RoleCode, string> = {
  CUSTOMER: '/customer/explore',
  VENDOR: '/vendor/home',
  WARD_AUTHORITY: '/ward/dashboard',
  PLATFORM_ADMIN: '/platform/dashboard',
};

export const GUEST_HOME_ROUTE = '/customer/explore';

/**
 * Roles that have no area on mobile — their work lives on the web only (quản trị nền tảng).
 * The app refuses to hold such a session: sign-in reports it and a stored one is dropped at
 * launch. To bring a role back to mobile, remove it here and re-mount its stack in `_layout`.
 */
export const WEB_ONLY_ROLES: readonly RoleCode[] = ['PLATFORM_ADMIN'];

export const isWebOnlyRole = (role: RoleCode): boolean => WEB_ONLY_ROLES.includes(role);

/** Shown when a web-only account tries to sign in on the phone. */
export const WEB_ONLY_SIGN_IN_MESSAGE =
  'Tài khoản quản trị nền tảng chỉ dùng trên bản web. Vui lòng đăng nhập bằng máy tính.';

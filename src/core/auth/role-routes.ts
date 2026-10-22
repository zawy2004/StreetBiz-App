import type { RoleCode } from '@/core/types/role';

/** Landing route for each role right after sign-in / app launch. */
export const ROLE_HOME_ROUTE: Record<RoleCode, string> = {
  CUSTOMER: '/customer/explore',
  VENDOR: '/vendor/home',
  WARD_AUTHORITY: '/ward/dashboard',
  PLATFORM_ADMIN: '/platform/dashboard',
};

export const GUEST_HOME_ROUTE = '/customer/explore';

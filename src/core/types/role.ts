/** Role codes, matching StreetBiz-BE `Roles.role_code` / AppConstants.RoleCodes. */
export type RoleCode = 'CUSTOMER' | 'VENDOR' | 'WARD_AUTHORITY' | 'PLATFORM_ADMIN';

export const ROLE_LABELS: Record<RoleCode, string> = {
  CUSTOMER: 'Người mua',
  VENDOR: 'Hộ kinh doanh',
  WARD_AUTHORITY: 'Cán bộ Phường',
  PLATFORM_ADMIN: 'Quản trị viên',
};

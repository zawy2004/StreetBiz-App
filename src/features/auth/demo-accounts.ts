import type { IconName } from '@/components/common/Icon';
import { isDev, isLiveApi } from '@/core/config/env';
import type { AccentTone } from '@/theme';

export type DemoAccount = { label: string; phone: string; icon: IconName; tone: AccentTone };

/**
 * One-tap sign-in for development. Live mode uses the accounts seeded by
 * StreetBiz-BE/db/StreetBiz_Demo_Seed.sql; the demo data has its own.
 */
export const DEMO_PASSWORD = isLiveApi ? 'Password123!' : '123456';

export const DEMO_ACCOUNTS: DemoAccount[] = isLiveApi
  ? [
      { label: 'Người mua', phone: '0905000201', icon: 'shopping-outline', tone: 'primary' },
      { label: 'Hộ kinh doanh', phone: '0905000101', icon: 'storefront-outline', tone: 'secondary' },
    ]
  : [
      { label: 'Người mua', phone: '0905000001', icon: 'shopping-outline', tone: 'primary' },
      { label: 'Hộ kinh doanh', phone: '0905000002', icon: 'storefront-outline', tone: 'secondary' },
    ];

/** Never offered outside development builds. */
export const showDemoAccounts = isDev;

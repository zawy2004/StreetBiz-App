import { Redirect, Stack, usePathname, useSegments } from 'expo-router';

import { useAreaRedirect } from '@/core/auth/guards';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

// Guests may browse (explore, scan, shop and vendor pages, cart). These need
// an account, as in StreetBiz-FE: placing and tracking orders, chatting with a
// shop and writing a review.
const MEMBERS_ONLY = new Set(['orders', 'chat', 'checkout', 'comment']);

export default function CustomerLayout() {
  const { colors } = useTheme();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const membersOnly = segments.slice(1).some((s) => MEMBERS_ONLY.has(s));
  const redirect = useAreaRedirect('customer', membersOnly ? { signInNext: pathname } : 'browse');

  if (redirect) return <Redirect href={redirect as never} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}

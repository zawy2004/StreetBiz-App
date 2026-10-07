import { Redirect, Stack } from 'expo-router';

import { useAreaRedirect } from '@/core/auth/guards';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

/** Hộ kinh doanh only: guests go to the welcome screen, other roles to their own home. */
export default function VendorLayout() {
  const { colors } = useTheme();
  const redirect = useAreaRedirect('vendor', 'welcome');
  if (redirect) return <Redirect href={redirect as never} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}

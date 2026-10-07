import { Redirect, Stack } from 'expo-router';

import { useAreaRedirect } from '@/core/auth/guards';
import { useTheme } from '@/theme';

export default function WardLayout() {
  const { colors } = useTheme();
  const redirect = useAreaRedirect('ward', 'welcome');
  if (redirect) return <Redirect href={redirect as never} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}

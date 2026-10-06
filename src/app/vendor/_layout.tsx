import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export default function VendorLayout() {
  const user = useAuthStore((s) => s.user);
  const { colors } = useTheme();
  if (!user) return <Redirect href={'/(auth)/sign-in' as never} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}

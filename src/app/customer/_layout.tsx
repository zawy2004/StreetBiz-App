import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

// Guests may browse and scan, so there is no auth redirect here.
export default function CustomerLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}

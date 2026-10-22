import { Stack } from 'expo-router';

import { headerOptions } from '@/core/navigation/header-options';

export default function AccountTabStack() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: 'Tài khoản', headerLargeTitleEnabled: true }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';

import { headerOptions } from '@/core/navigation/header-options';

export default function AdminMeStack() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: 'Cá nhân', headerLargeTitleEnabled: true }} />
    </Stack>
  );
}

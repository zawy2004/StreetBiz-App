import { Stack } from 'expo-router';

import { headerOptions } from '@/core/navigation/header-options';

export const unstable_settings = { initialRouteName: 'index' };

/** Stack of the platform admin's accounts tab. */
export default function AccountsStack() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: '' }} />
    </Stack>
  );
}

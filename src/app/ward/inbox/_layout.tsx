import { Stack } from 'expo-router';

import { headerOptions } from '@/core/navigation/header-options';

export const unstable_settings = { initialRouteName: 'index' };

/** Stack of the ward officer's inbox tab. */
export default function InboxStack() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: '' }} />
    </Stack>
  );
}

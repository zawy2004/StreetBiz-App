import { Stack } from 'expo-router';

import { headerOptions } from '@/core/navigation/header-options';

export const unstable_settings = { initialRouteName: 'index' };

/** Stack of the platform admin's moderation tab. */
export default function ModerationStack() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: '' }} />
    </Stack>
  );
}

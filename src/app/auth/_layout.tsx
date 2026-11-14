import { Stack } from 'expo-router';

import { headerOptions } from '@/core/navigation/header-options';

/** Sign-in, sign-up and password reset: a plain stack, the header only carries the back arrow. */
export default function AuthStack() {
  return (
    <Stack screenOptions={{ ...headerOptions, title: '', headerTransparent: false }}>
      <Stack.Screen name="sign-in/index" options={{ headerShown: false }} />
    </Stack>
  );
}

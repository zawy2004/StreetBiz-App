import { Stack } from 'expo-router';

import { headerOptions } from '@/core/navigation/header-options';

export const unstable_settings = { initialRouteName: 'index' };

/** Stack of the buyer's scan tab. */
export default function ScanStack() {
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Screen name="index" options={{ title: 'Quét mã giấy phép' }} />
    </Stack>
  );
}

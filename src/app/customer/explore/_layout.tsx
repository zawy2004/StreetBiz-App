import { Stack } from 'expo-router';

import { headerOptions } from '@/core/navigation/header-options';

export const unstable_settings = { initialRouteName: 'index' };

/** Stack of the buyer's explore tab. */
export default function ExploreStack() {
  return (
    <Stack screenOptions={headerOptions}>
      {/* Khám phá draws its own pinned bar (pickup area + cart), like every food marketplace */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="map" options={{ title: 'Bản đồ' }} />
    </Stack>
  );
}

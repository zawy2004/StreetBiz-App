import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import { AppHeader } from './AppHeader';

/** Declares a back-arrow header for a stack screen (root layout hides headers by default). */
export function StackHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <Stack.Screen
      options={{ headerShown: true, header: () => <AppHeader title={title} back right={right} /> }}
    />
  );
}

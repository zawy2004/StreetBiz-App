import { Stack } from 'expo-router';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ToastHost } from '@/components/feedback/Toast';
import { AppProviders } from '@/providers/AppProviders';
import { useAuthStore } from '@/store/auth-store';
import { headerOptions } from '@/core/navigation/header-options';
import { colors, useAppFonts } from '@/theme';

/** Light only for this release (master prompt v3 §11): the brand is bright. */
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.cta,
    background: colors.bg,
    card: colors.bg,
    text: colors.ink,
    border: colors.separator,
  },
};


/**
 * Root: providers, the stored session read once at launch, then one stack whose groups are
 * guarded by role exactly like the web's RoleGuard (`route-role-matrix.md`):
 * guests and buyers see /customer, each other role only its own area, and the account
 * pages need any signed-in user. A screen whose guard fails is unreachable, and the index
 * route sends everyone to their home.
 */
export default function RootLayout() {
  const fontsReady = useAppFonts();
  const ready = useAuthStore((s) => s.ready);
  const role = useAuthStore((s) => s.user?.role_code);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AppProviders>
          <ThemeProvider value={theme}>
            {/* Expo Go on Android paints an opaque black status bar unless asked for a transparent, translucent one. */}
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            {fontsReady && ready ? (
              <Stack screenOptions={{ headerShown: false, ...headerOptions }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="legal/[doc]" options={{ headerShown: true, title: '' }} />

                <Stack.Protected guard={!role || role === 'CUSTOMER'}>
                  <Stack.Screen name="customer" />
                  <Stack.Screen name="checkout" options={{ headerShown: true, title: 'Thanh toán' }} />
                </Stack.Protected>

                <Stack.Protected guard={role === 'VENDOR'}>
                  <Stack.Screen name="vendor" />
                  <Stack.Screen name="permit-qr" options={{ presentation: 'fullScreenModal' }} />
                </Stack.Protected>

                <Stack.Protected guard={role === 'WARD_AUTHORITY'}>
                  <Stack.Screen name="ward" />
                </Stack.Protected>

                <Stack.Protected guard={role === 'PLATFORM_ADMIN'}>
                  <Stack.Screen name="platform" />
                </Stack.Protected>

                <Stack.Protected guard={!!role}>
                  <Stack.Screen name="account" />
                  <Stack.Screen name="notifications" options={{ headerShown: true }} />
                </Stack.Protected>
              </Stack>
            ) : (
              <View style={{ flex: 1, backgroundColor: colors.bg }} />
            )}
            <OfflineBanner />
            <ToastHost />
          </ThemeProvider>
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

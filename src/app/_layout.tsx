import {
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
  BeVietnamPro_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/be-vietnam-pro';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/feedback/Toast';
import { queryClient } from '@/core/api/query-client';
import { getTokens, hydrateTokens } from '@/core/api/token-storage';
import { isLiveApi } from '@/core/config/env';
import { useAuthHydrated, useAuthStore } from '@/store/auth-store';
import { ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function ThemedStack() {
  const { scheme, colors } = useTheme();

  // React Navigation paints its own containers (and the screen behind a
  // transition); without this they flash white in dark mode.
  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.card,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
      },
    };
  }, [scheme, colors]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <ToastHost />
    </NavigationThemeProvider>
  );
}

/**
 * Loads the saved tokens once. In live mode a persisted account without tokens
 * (e.g. left over from the demo mode) is not a session, so it is dropped.
 */
function useTokensReady(sessionReady: boolean) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!sessionReady) return;
    void hydrateTokens().then(() => {
      if (isLiveApi && useAuthStore.getState().user && !getTokens()) useAuthStore.setState({ user: null });
      setReady(true);
    });
  }, [sessionReady]);
  return ready;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
    BeVietnamPro_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  const sessionReady = useAuthHydrated();
  const tokensReady = useTokensReady(sessionReady);
  if ((!fontsLoaded && !fontError) || !sessionReady || !tokensReady) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedStack />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

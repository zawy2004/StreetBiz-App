import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

/** Same React Query defaults as the web (`AppProviders.tsx`). */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
    },
  });
}

// Queries pause while the phone is offline and resume when it reconnects.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

/**
 * Polling (chat, notifications, new orders) follows the app being in the foreground,
 * the app's equivalent of the browser tab being visible.
 */
function useAppFocus() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) =>
      focusManager.setFocused(status === 'active'),
    );
    return () => sub.remove();
  }, []);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  useAppFocus();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

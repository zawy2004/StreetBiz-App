import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useAuthStore } from '@/store/auth-store';

/**
 * Development-only account switch for scripted checks of the UI rebuild (API baseline crawl):
 * `/kit?as=<demo phone>` signs in as that demo account, `/kit?as=out` signs out. The demo
 * password comes from EXPO_PUBLIC_DEMO_PASSWORD given to Metro, never from the code.
 */
export function DevSwitch({ as }: { as: string }) {
  const [state, setState] = useState('…');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const store = useAuthStore.getState();
      try {
        if (store.user) await store.signOut();
        if (as !== 'out') {
          const password = process.env.EXPO_PUBLIC_DEMO_PASSWORD;
          if (!password) throw new Error('EXPO_PUBLIC_DEMO_PASSWORD missing');
          await store.signIn(as, password);
        }
        if (!cancelled) {
          setState('DEV-SWITCH-OK');
          console.log(`[DEV-SWITCH] ${as} ok`);
          router.replace('/');
        }
      } catch (e) {
        console.log(`[DEV-SWITCH] ${as} failed ${String(e)}`);
        if (!cancelled) setState(`DEV-SWITCH-FAILED ${String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [as]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{state}</Text>
    </View>
  );
}

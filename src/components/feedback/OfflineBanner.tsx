import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/common/Icon';
import { colors, fonts } from '@/theme';

/**
 * A slim strip under the status bar while the phone has no connection. Actions that need
 * the server say so on their own; a permit is never shown from memory while offline.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((s) =>
        setOffline(s.isConnected === false || s.isInternetReachable === false),
      ),
    [],
  );
  if (!offline) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(140)}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', top: insets.top + 4, left: 0, right: 0, alignItems: 'center' }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: colors.mango,
          boxShadow: '0 6px 16px -8px rgba(17, 28, 43, 0.35)',
        }}
      >
        <Icon sf="wifi.slash" md="wifi_off" size={14} color={colors.onMango} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onMango }}>
          Mất kết nối mạng, đang chờ kết nối lại…
        </Text>
      </View>
    </Animated.View>
  );
}

import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Icon } from '@/components/common/Icon';
import { colors, fonts } from '@/theme';

type Tone = 'success' | 'error' | 'info';
type ToastState = {
  message: string | null;
  tone: Tone;
  key: number;
  show: (message: string, tone?: Tone) => void;
  hide: () => void;
};

/** One message at a time; a new one replaces the old (the web's toast store). */
export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'success',
  key: 0,
  show: (message, tone = 'success') => set((s) => ({ message, tone, key: s.key + 1 })),
  hide: () => set({ message: null }),
}));

export const showToast = (message: string, tone: Tone = 'success') =>
  useToast.getState().show(message, tone);

const TONES: Record<Tone, { bg: string; icon: { sf: string; md: string } }> = {
  success: { bg: colors.ink, icon: { sf: 'checkmark.circle.fill', md: 'check_circle' } },
  error: { bg: colors.onDanger, icon: { sf: 'exclamationmark.circle.fill', md: 'error' } },
  info: { bg: colors.sign, icon: { sf: 'info.circle.fill', md: 'info' } },
};

/**
 * Confirms a finished action in a short dark capsule above the tab bar, for 2.6 s (as on
 * the web). Announced to screen readers; never the only feedback for an error.
 */
export function ToastHost() {
  const { message, tone, key, hide } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 2600);
    return () => clearTimeout(t);
  }, [message, key, hide]);
  if (!message) return null;
  const t = TONES[tone];
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 96, alignItems: 'center' }}
    >
      <Animated.View
        key={key}
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(140)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          maxWidth: 420,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: t.bg,
          boxShadow: '0 12px 28px -12px rgba(17, 28, 43, 0.45)',
        }}
      >
        <Icon sf={t.icon.sf} md={t.icon.md} size={18} color={colors.white} />
        <Text style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.white }}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

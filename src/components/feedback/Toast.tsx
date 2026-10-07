import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { errorMessage } from '@/core/api/problem';
import { radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon } from '../common/Icon';

type Toast = { id: number; message: string; tone: 'ok' | 'error' };

const useToasts = create<{ current: Toast | null; show: (message: string, tone: Toast['tone']) => void; hide: () => void }>((set) => ({
  current: null,
  show: (message, tone) => set({ current: { id: Date.now(), message, tone } }),
  hide: () => set({ current: null }),
}));

/** Short confirmation or failure message for one-tap actions (works on the web build, unlike Alert). */
export const showToast = (message: string, tone: Toast['tone'] = 'ok') => useToasts.getState().show(message, tone);
export const showError = (error: unknown) => showToast(errorMessage(error), 'error');

export function ToastHost() {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToasts((s) => s.current);
  const hide = useToasts((s) => s.hide);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, 3500);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  const error = toast.tone === 'error';
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
      <Pressable
        accessibilityRole="alert"
        onPress={hide}
        style={[styles.toast, shadow.raised, { backgroundColor: error ? colors.error : colors.indigo }]}
      >
        <Icon name={error ? 'alert-circle-outline' : 'check-circle-outline'} size={20} color={error ? '#FFFFFF' : colors.onIndigo} />
        <AppText variant="labelSm" style={[styles.text, { color: error ? '#FFFFFF' : colors.onIndigo }]}>{toast.message}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.chip,
  },
  text: { flexShrink: 1 },
});

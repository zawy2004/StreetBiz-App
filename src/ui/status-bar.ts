import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StatusBar, type StatusBarStyle } from 'react-native';

/**
 * Tints the status-bar icons while this screen is in front, pushed on the same stack as the root
 * `<StatusBar>` and popped on blur, so every other screen keeps its own style. `light-content`
 * (white icons) suits a screen that paints its own top orange/green/red/camera-dark.
 *
 * react-native-web has no StatusBar stack API, so this is a no-op in the browser preview
 * (there is no device status bar to tint there anyway).
 */
export function useStatusBarStyle(barStyle: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      if (typeof StatusBar.pushStackEntry !== 'function') return;
      const entry = StatusBar.pushStackEntry({ barStyle, animated: true });
      return () => StatusBar.popStackEntry?.(entry);
    }, [barStyle]),
  );
}

/** White status-bar icons while this screen is in front. */
export function useLightStatusBar() {
  useStatusBarStyle('light-content');
}

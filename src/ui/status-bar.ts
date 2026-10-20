import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StatusBar } from 'react-native';

/**
 * White status-bar icons while this screen is in front (it paints the top of the screen orange,
 * green, red or camera-dark). Pushed on the same stack as the root `<StatusBar>`, popped on blur,
 * so every other screen keeps the dark icons.
 */
export function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      const entry = StatusBar.pushStackEntry({ barStyle: 'light-content', animated: true });
      return () => StatusBar.popStackEntry(entry);
    }, []),
  );
}

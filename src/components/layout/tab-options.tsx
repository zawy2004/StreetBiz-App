import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/components/common/Icon';
import { fontFamilies, radius, useTheme } from '@/theme';

import { AppHeader } from './AppHeader';

/** Shared look for every role's bottom tab bar; `headerRight` differs per role (guest, buyer, seller). */
export function useTabScreenOptions(headerRight?: ReactNode) {
  const { colors, shadow, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 6);

  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: { fontFamily: fontFamilies.semibold, fontSize: 11, marginTop: 2 },
    tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary, fontFamily: fontFamilies.semibold, fontSize: 10 },
    tabBarStyle: {
      ...shadow.bar,
      backgroundColor: colors.card,
      borderTopColor: scheme === 'dark' ? colors.border : 'transparent',
      borderTopWidth: StyleSheet.hairlineWidth,
      height: 64 + bottom,
      paddingTop: 8,
      paddingBottom: bottom,
    },
    sceneStyle: { backgroundColor: colors.bg },
    header: ({ options }: { options: { title?: string } }) => <AppHeader title={options.title ?? ''} right={headerRight} />,
  };
}

/** Tab icon with a soft pill behind it while selected (Material 3 style indicator). */
export function tabIcon(name: IconName, focusedName?: IconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    const { colors } = useTheme();
    return (
      <View style={[styles.pill, focused ? { backgroundColor: colors.primarySoft } : null]}>
        <Icon name={focused && focusedName ? focusedName : name} size={22} color={color as string} />
      </View>
    );
  }
  return TabIcon;
}

const styles = StyleSheet.create({
  pill: { width: 52, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});

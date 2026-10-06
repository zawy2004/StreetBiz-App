import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/common/Icon';
import { goTo } from '@/core/navigation/go';
import { fontFamilies, useTheme } from '@/theme';

import { AppHeader, HeaderIconButton } from './AppHeader';

/** Shared look for every role's bottom tab bar. */
export function useTabScreenOptions() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 12 : 6);

  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: { fontFamily: fontFamilies.semibold, fontSize: 12 },
    tabBarStyle: {
      backgroundColor: colors.card,
      borderTopColor: colors.border,
      height: 60 + bottom,
      paddingTop: 8,
      paddingBottom: bottom,
    },
    header: ({ options }: { options: { title?: string } }) => (
      <AppHeader
        title={options.title ?? ''}
        right={<HeaderIconButton icon="bell-outline" label="Thông báo" onPress={() => goTo('/notifications')} />}
      />
    ),
  };
}

export function tabIcon(name: IconName) {
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={24} color={color as string} />;
  }
  return TabIcon;
}

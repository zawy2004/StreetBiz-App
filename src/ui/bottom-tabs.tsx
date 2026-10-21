import { StyleSheet, Text, type ColorValue } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors, fonts } from '@/theme';

/**
 * The v5 bottom tab bar ("Biển hiệu phố") built on expo-router's JS `Tabs`, so the bar sits at the
 * BOTTOM on every platform — iPhone, Android and the web preview alike (the experimental
 * `NativeTabs` drew itself across the top of the screen on web). White bar on a hairline kerb,
 * the chosen tab in orange, its label heavy; the safe-area inset under the bar is handled for us.
 */
export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.cta,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: {
    backgroundColor: colors.white,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tabBarBadgeStyle: {
    backgroundColor: colors.cta,
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
} as const;

/** A tab's icon: the filled symbol when chosen, the outline otherwise (SF on iOS, Material elsewhere). */
export function tabIcon(sf: string, sfSelected: string, md: string) {
  function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Icon sf={focused ? sfSelected : sf} md={md} size={25} color={color} weight={focused ? 'semibold' : 'regular'} />;
  }
  return TabIcon;
}

/** A tab's label: heavy and orange when chosen, semibold and muted otherwise. */
export function tabLabel(text: string) {
  function TabLabel({ focused, color }: { focused: boolean; color: ColorValue }) {
    return (
      <Text
        numberOfLines={1}
        style={{ fontFamily: focused ? fonts.heavy : fonts.semibold, fontSize: 11, color, marginTop: 1 }}
      >
        {text}
      </Text>
    );
  }
  return TabLabel;
}

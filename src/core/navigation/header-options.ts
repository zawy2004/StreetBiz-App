import { colors, fonts } from '@/theme';

/** Shared look of every native header in the app. */
export const headerOptions = {
  contentStyle: { backgroundColor: colors.bg },
  headerTitleStyle: { fontFamily: fonts.heavy, fontSize: 17, color: colors.ink },
  headerLargeTitleStyle: { fontFamily: fonts.heavy, color: colors.ink },
  headerTintColor: colors.primary,
  headerShadowVisible: false,
  headerLargeTitleShadowVisible: false,
  statusBarTranslucent: true,
  statusBarStyle: 'dark' as const,
  headerStyle: { backgroundColor: colors.bg },
  headerBackButtonDisplayMode: 'minimal' as const,
};

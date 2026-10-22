import { colors, fonts } from '@/theme';

/**
 * v5 look of every role's native tab bar: white bar, the chosen tab in orange on an orange-tint
 * pill (Android's indicator; iOS keeps its own selection), heavy label for the chosen one.
 */
export const tabBarLook = {
  tintColor: colors.cta,
  backgroundColor: colors.white,
  indicatorColor: colors.brandTint,
  rippleColor: 'rgba(238, 85, 0, 0.12)',
  badgeBackgroundColor: colors.cta,
  iconColor: { default: colors.muted, selected: colors.cta },
  labelStyle: {
    default: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
    selected: { fontFamily: fonts.heavy, fontSize: 12, color: colors.primary },
  },
} as const;

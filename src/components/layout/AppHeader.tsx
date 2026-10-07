import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { layout, radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { BrandMark } from '../common/BrandMark';
import { Icon, type IconName } from '../common/Icon';

type Props = {
  title: string;
  /** Stack screens show a back arrow; tab roots show the brand mark instead. */
  back?: boolean;
  right?: ReactNode;
};

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Small dot for "something new"; `badge` shows a count instead. */
  dot?: boolean;
  badge?: number;
};

export function HeaderIconButton({ icon, label, onPress, dot, badge }: IconButtonProps) {
  const { colors } = useTheme();
  const count = badge && badge > 0 ? (badge > 9 ? '9+' : String(badge)) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${badge}` : label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? colors.sunken : colors.card, borderColor: colors.border }]}
    >
      <Icon name={icon} size={22} color="text" />
      {count ? (
        <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.bg }]}>
          <AppText variant="badge" color="onPrimary" style={styles.badgeText}>{count}</AppText>
        </View>
      ) : dot ? (
        <View style={[styles.dot, { backgroundColor: colors.primary, borderColor: colors.card }]} />
      ) : null}
    </Pressable>
  );
}

/** Compact filled call to action for the header, e.g. "Đăng nhập" for guests. */
export function HeaderPill({ label, icon, onPress }: { label: string; icon?: IconName; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? colors.primaryPressed : colors.primary }]}
    >
      {icon ? <Icon name={icon} size={18} color="onPrimary" /> : null}
      <AppText variant="labelSm" color="onPrimary">{label}</AppText>
    </Pressable>
  );
}

export function AppHeader({ title, back, right }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.bg }]}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as never))}
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? colors.sunken : colors.card, borderColor: colors.border }]}
        >
          <Icon name="arrow-left" size={22} color="text" />
        </Pressable>
      ) : (
        <BrandMark size={30} />
      )}
      <AppText variant={back ? 'headline' : 'title'} numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.md,
  },
  title: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 9, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 13 },
  pill: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
});

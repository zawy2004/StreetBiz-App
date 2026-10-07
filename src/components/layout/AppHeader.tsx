import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { layout, radius, spacing, useTheme } from '@/theme';

import { AppText } from '../common/AppText';
import { Icon, type IconName } from '../common/Icon';

type Props = {
  title: string;
  /** Stack screens show a back arrow; tab roots show the brand mark instead. */
  back?: boolean;
  right?: ReactNode;
};

export function HeaderIconButton({ icon, label, onPress, dot }: { icon: IconName; label: string; onPress: () => void; dot?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={styles.iconBtn}>
      <Icon name={icon} size={24} color="indigo" />
      {dot ? <View style={[styles.dot, { backgroundColor: colors.primary, borderColor: colors.bg }]} /> : null}
    </Pressable>
  );
}

export function AppHeader({ title, back, right }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Icon name="arrow-left" size={24} color="indigo" />
        </Pressable>
      ) : (
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Icon name="bank" size={22} color="onPrimary" />
        </View>
      )}
      <AppText variant="title" numberOfLines={1} style={styles.title}>{title}</AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1 },
  logo: { width: 36, height: 36, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});

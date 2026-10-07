import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { layout, radius, spacing, useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Drops the side padding so a child (hero, carousel) can run edge to edge. */
  flush?: boolean;
  testID?: string;
};

export function Screen({ children, footer, scroll = true, onRefresh, refreshing = false, flush, testID }: Props) {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const content = [styles.content, flush ? styles.flush : null];

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: colors.bg }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[...content, styles.fill]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            shadow.bar,
            { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: { padding: layout.screenMargin, paddingBottom: spacing.xxl, gap: spacing.lg },
  flush: { paddingHorizontal: 0 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
});

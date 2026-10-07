import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { layout, spacing, stickyShadow, useTheme } from '@/theme';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  testID?: string;
};

export function Screen({ children, footer, scroll = true, onRefresh, refreshing = false, testID }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: colors.bg }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            stickyShadow,
            { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.md) },
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
  content: { padding: layout.screenMargin, gap: spacing.lg },
  footer: { borderTopWidth: 1, paddingHorizontal: layout.screenMargin, paddingTop: spacing.md, gap: spacing.sm },
});

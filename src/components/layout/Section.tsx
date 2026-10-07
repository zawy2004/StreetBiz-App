import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { spacing } from '@/theme';

import { AppText } from '../common/AppText';

type Props = {
  title: string;
  subtitle?: string;
  /** Custom right-hand slot; `actionLabel` + `onAction` render the usual "Xem tất cả" link. */
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
};

export function Section({ title, subtitle, action, actionLabel, onAction, children }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="headline">{title}</AppText>
          {subtitle ? <AppText variant="small" color="muted">{subtitle}</AppText> : null}
        </View>
        {action}
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
            <AppText variant="labelSm" color="primary">{actionLabel}</AppText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  titles: { flex: 1, gap: 2 },
});

import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Card } from './Card';

export type KeyValue = { label: string; value?: string; node?: ReactNode };

/** Label on the left, value on the right, hairline between rows. */
export function KeyValueCard({ rows }: { rows: KeyValue[] }) {
  const { colors } = useTheme();
  return (
    <Card padded={false}>
      {rows.map((r, i) => (
        <View
          key={r.label}
          style={[styles.row, i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null]}
        >
          <AppText variant="small" color="muted" style={styles.label}>{r.label}</AppText>
          {r.node ?? <AppText variant="label" align="right" style={styles.value}>{r.value}</AppText>}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  label: { flexShrink: 0 },
  value: { flex: 1 },
});

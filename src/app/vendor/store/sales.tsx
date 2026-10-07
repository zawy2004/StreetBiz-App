import dayjs from 'dayjs';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { HeroCard } from '@/components/common/HeroCard';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { useVendorOrders } from '@/features/orders/use-orders';
import { spacing, useTheme } from '@/theme';
import { formatVnd, parseInstant } from '@/utils/format';

type Range = 'today' | 'week' | 'month';

/** SORD-04: completed orders and best sellers over a period. */
export default function SalesSummaryScreen() {
  const { colors } = useTheme();
  const orders = useVendorOrders();
  const [range, setRange] = useState<Range>('today');

  const since = range === 'today' ? dayjs().startOf('day') : range === 'week' ? dayjs().subtract(7, 'day') : dayjs().startOf('month');
  const done = (orders.data ?? []).filter((o) => o.status === 'COMPLETED' && parseInstant(o.completedAt ?? o.createdAt).isAfter(since));
  const revenue = done.reduce((n, o) => n + o.total, 0);
  const tally = new Map<string, number>();
  done.forEach((o) => o.items.forEach((i) => tally.set(i.name, (tally.get(i.name) ?? 0) + i.quantity)));
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <StackHeader title="Doanh thu" />
      <Screen onRefresh={orders.refetch} refreshing={orders.isRefetching}>
        <SegmentedControl
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Hôm nay' },
            { value: 'week', label: '7 ngày' },
            { value: 'month', label: 'Tháng này' },
          ]}
        />
        <QueryView query={orders}>
          {() => (
            <>
              <HeroCard accent="green">
                <AppText variant="eyebrow" style={{ color: colors.heroMuted }}>Doanh thu</AppText>
                <AppText variant="moneyLg" style={{ color: colors.onHero }}>{formatVnd(revenue)}</AppText>
                <AppText variant="small" style={{ color: colors.heroMuted }}>{done.length} đơn hoàn tất</AppText>
              </HeroCard>

              <Section title="Bán chạy">
                {top.length ? (
                  <Card padded={false}>
                    {top.map(([name, qty], i) => (
                      <View key={name} style={[styles.row, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}>
                        <AppText variant="label" color="primary" style={styles.rank}>{i + 1}</AppText>
                        <AppText style={styles.name}>{name}</AppText>
                        <AppText variant="small" color="muted">{qty} phần</AppText>
                      </View>
                    ))}
                  </Card>
                ) : (
                  <EmptyState icon="chart-line" title="Chưa có đơn hoàn tất" />
                )}
              </Section>
            </>
          )}
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  rank: { width: 20 },
  name: { flex: 1 },
});

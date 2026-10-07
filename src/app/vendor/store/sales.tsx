import dayjs from 'dayjs';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { useMockDb } from '@/mocks/db';
import { spacing, useTheme } from '@/theme';

type Range = 'today' | 'week' | 'month';

export default function SalesSummaryScreen() {
  const { colors } = useTheme();
  const gate = useMarketplaceGate();
  const orders = useMockDb((s) => s.orders);
  const [range, setRange] = useState<Range>('today');

  const unit = range === 'today' ? 'day' : range === 'week' ? 'week' : 'month';
  const done = orders.filter(
    (o) =>
      o.storefrontId === gate.storefront?.id &&
      o.order_status === 'COMPLETED' &&
      (range === 'week' ? dayjs(o.created_at).isAfter(dayjs().subtract(7, 'day')) : dayjs(o.created_at).isSame(dayjs(), unit)),
  );

  const revenue = done.reduce((n, o) => n + o.total, 0);
  const tally = new Map<string, number>();
  done.forEach((o) => o.items.forEach((i) => tally.set(i.name, (tally.get(i.name) ?? 0) + i.quantity)));
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <StackHeader title="Doanh thu" />
      <Screen>
        <SegmentedControl
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Hôm nay' },
            { value: 'week', label: '7 ngày' },
            { value: 'month', label: 'Tháng' },
          ]}
        />
        <Card style={styles.total}>
          <AppText variant="small" color="muted">Doanh thu</AppText>
          <Money amountVnd={revenue} size="lg" color="primary" />
          <AppText variant="small" color="muted">{done.length} đơn</AppText>
        </Card>

        <Section title="Bán chạy">
          {top.length ? (
            <Card padded={false}>
              {top.map(([name, qty], i) => (
                <View key={name} style={[styles.row, i > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null]}>
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
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  total: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  rank: { width: 20 },
  name: { flex: 1 },
});

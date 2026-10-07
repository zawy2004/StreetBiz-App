import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { HeroCard } from '@/components/common/HeroCard';
import { ListRow } from '@/components/common/ListRow';
import { Money } from '@/components/common/Money';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { isFeeOpen, isPenaltyOpen, useFees, usePenalties } from '@/features/finance/use-finance';
import { spacing, useTheme } from '@/theme';
import { formatDate, formatVnd } from '@/utils/format';

/** FEE-01…05: what the vendor owes, and the way to pay it. */
export default function FinanceScreen() {
  const { colors } = useTheme();
  const fees = useFees();
  const penalties = usePenalties();
  const [tab, setTab] = useState<'fees' | 'penalties'>('fees');

  const dueFees = (fees.data ?? []).filter(isFeeOpen);
  const duePenalties = (penalties.data ?? []).filter(isPenaltyOpen);
  const total = dueFees.reduce((n, f) => n + f.amount, 0) + duePenalties.reduce((n, p) => n + p.amount, 0);
  const first = dueFees[0] ? `/vendor/finance/fees/${dueFees[0].id}` : duePenalties[0] ? `/vendor/finance/penalties/${duePenalties[0].id}` : undefined;

  return (
    <Screen
      onRefresh={() => {
        fees.refetch();
        penalties.refetch();
      }}
    >
      <HeroCard accent={total ? 'brand' : 'green'}>
        <AppText variant="eyebrow" style={{ color: colors.heroMuted }}>Cần thanh toán</AppText>
        <AppText variant="moneyLg" style={{ color: colors.onHero }}>{formatVnd(total)}</AppText>
        <AppText variant="small" style={{ color: colors.heroMuted }}>
          {total ? `${dueFees.length} khoản phí · ${duePenalties.length} tiền phạt chưa đóng` : 'Bạn đã đóng đủ mọi khoản, cảm ơn!'}
        </AppText>
        {first ? <Button label="Thanh toán ngay" icon="wallet-outline" onPress={() => goTo(first)} /> : null}
      </HeroCard>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'fees', label: 'Phí thuê' },
          { value: 'penalties', label: 'Tiền phạt' },
        ]}
      />

      {tab === 'fees' ? (
        <QueryView query={fees}>
          {(list) =>
            list.length ? (
              list.map((f) => (
                <Card key={f.id} onPress={() => (isFeeOpen(f) ? goTo(`/vendor/finance/fees/${f.id}`) : goTo('/vendor/finance/invoices'))} style={styles.row}>
                  <View style={styles.rowBody}>
                    <AppText variant="label">Phí thuê ô {f.period}</AppText>
                    <AppText variant="small" color="muted">{[f.slotCode, `hạn ${formatDate(f.dueDate)}`].filter(Boolean).join(' · ')}</AppText>
                    <StatusChip code={f.status} />
                  </View>
                  <Money amountVnd={f.amount} />
                </Card>
              ))
            ) : (
              <EmptyState icon="receipt-text-outline" title="Chưa có khoản phí" />
            )
          }
        </QueryView>
      ) : (
        <QueryView query={penalties}>
          {(list) =>
            list.length ? (
              list.map((p) => (
                <Card key={p.id} onPress={() => goTo(isPenaltyOpen(p) ? `/vendor/finance/penalties/${p.id}` : '/vendor/finance/violations')} style={styles.row}>
                  <View style={styles.rowBody}>
                    <AppText variant="label" numberOfLines={2}>{p.reason}</AppText>
                    <AppText variant="small" color="muted">{[p.slotCode, formatDate(p.issuedAt)].filter(Boolean).join(' · ')}</AppText>
                    <StatusChip code={p.status} />
                  </View>
                  <Money amountVnd={p.amount} />
                </Card>
              ))
            ) : (
              <EmptyState icon="shield-check-outline" tone="tertiary" title="Không có tiền phạt" />
            )
          }
        </QueryView>
      )}

      <Card padded={false}>
        <ListRow icon="file-document-outline" title="Hoá đơn" onPress={() => goTo('/vendor/finance/invoices')} />
        <ListRow icon="history" iconTone="tertiary" title="Lịch sử thanh toán" onPress={() => goTo('/vendor/finance/history')} />
        <ListRow icon="alert-outline" iconTone="error" title="Biên bản vi phạm" onPress={() => goTo('/vendor/finance/violations')} last />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, gap: spacing.xs },
});

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ListRow } from '@/components/common/ListRow';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { feeStatus, isFeeDue } from '@/features/finance/utils';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { radius, spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

export default function FinanceScreen() {
  const { colors } = useTheme();
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const fees = useMockDb((s) => s.feeItems).filter((f) => f.vendorId === vendorId);
  const penalties = useMockDb((s) => s.penalties).filter((p) => p.vendorId === vendorId);
  const [tab, setTab] = useState<'fees' | 'penalties'>('fees');

  const dueFees = fees.filter(isFeeDue);
  const duePenalties = penalties.filter((p) => p.penalty_status === 'PENDING');
  const total = dueFees.reduce((n, f) => n + f.amount, 0) + duePenalties.reduce((n, p) => n + p.amount, 0);
  const first = dueFees[0] ? `/vendor/finance/fees/${dueFees[0].id}` : duePenalties[0] ? `/vendor/finance/penalties/${duePenalties[0].id}` : undefined;

  return (
    <Screen>
      <View style={[styles.summary, { backgroundColor: colors.indigo }]}>
        <AppText variant="small" color="onIndigo" style={styles.dim}>Cần thanh toán</AppText>
        <AppText variant="moneyLg" color="onIndigo">{new Intl.NumberFormat('vi-VN').format(total)} đ</AppText>
        {first ? <Button label="Thanh toán ngay" onPress={() => goTo(first)} /> : null}
      </View>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'fees', label: 'Phí thuê' },
          { value: 'penalties', label: 'Tiền phạt' },
        ]}
      />

      {tab === 'fees' ? (
        fees.length ? (
          fees.map((f) => (
            <Card key={f.id} onPress={() => (isFeeDue(f) ? goTo(`/vendor/finance/fees/${f.id}`) : goTo('/vendor/finance/invoices'))} style={styles.row}>
              <View style={styles.rowBody}>
                <AppText variant="label">Phí thuê ô {f.period_label}</AppText>
                <AppText variant="small" color="muted">Hạn {formatDate(f.due_date)}</AppText>
                <StatusChip code={feeStatus(f)} />
              </View>
              <Money amountVnd={f.amount} />
            </Card>
          ))
        ) : (
          <EmptyState icon="receipt-text-outline" title="Chưa có khoản phí" />
        )
      ) : penalties.length ? (
        penalties.map((p) => (
          <Card key={p.id} onPress={() => goTo(p.penalty_status === 'PENDING' ? `/vendor/finance/penalties/${p.id}` : '/vendor/finance/violations')} style={styles.row}>
            <View style={styles.rowBody}>
              <AppText variant="label" numberOfLines={2}>{p.reason}</AppText>
              <AppText variant="small" color="muted">{formatDate(p.issued_at)}</AppText>
              <StatusChip code={p.penalty_status === 'PENDING' ? 'UNPAID' : p.penalty_status} />
            </View>
            <Money amountVnd={p.amount} />
          </Card>
        ))
      ) : (
        <EmptyState icon="shield-check-outline" title="Không có tiền phạt" />
      )}

      <Card padded={false}>
        <ListRow icon="file-document-outline" title="Hoá đơn" onPress={() => goTo('/vendor/finance/invoices')} />
        <ListRow icon="history" title="Lịch sử thanh toán" onPress={() => goTo('/vendor/finance/history')} />
        <ListRow icon="alert-outline" title="Biên bản vi phạm" onPress={() => goTo('/vendor/finance/violations')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: radius.card, padding: spacing.lg, gap: spacing.md },
  dim: { opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, gap: spacing.xs },
});

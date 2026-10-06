import dayjs from 'dayjs';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';
import { formatDateTime } from '@/utils/format';

type Entry = { id: string; title: string; amount: number; at: string; status: string };

export default function PaymentHistoryScreen() {
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const fees = useMockDb((s) => s.feeItems);
  const invoices = useMockDb((s) => s.invoices);
  const penalties = useMockDb((s) => s.penalties);

  const entries: Entry[] = [
    ...invoices
      .filter((i) => i.vendorId === vendorId)
      .map((i) => ({
        id: i.id,
        title: `Phí thuê ô ${fees.find((f) => f.id === i.feeItemId)?.period_label ?? ''}`.trim(),
        amount: i.amount,
        at: i.issued_at,
        status: 'PAID',
      })),
    ...penalties
      .filter((p) => p.vendorId === vendorId && p.penalty_status === 'PAID')
      .map((p) => ({ id: p.id, title: p.reason, amount: p.amount, at: p.issued_at, status: 'PAID' })),
  ].sort((a, b) => dayjs(b.at).valueOf() - dayjs(a.at).valueOf());

  return (
    <>
      <StackHeader title="Lịch sử thanh toán" />
      <Screen>
        {entries.length ? (
          entries.map((e) => (
            <Card key={e.id} style={styles.row}>
              <View style={styles.body}>
                <AppText variant="label" numberOfLines={2}>{e.title}</AppText>
                <AppText variant="small" color="muted">{formatDateTime(e.at)}</AppText>
                <StatusChip code={e.status} />
              </View>
              <Money amountVnd={e.amount} />
            </Card>
          ))
        ) : (
          <EmptyState icon="history" title="Chưa có giao dịch" />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
});

import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { usePaymentHistory } from '@/features/finance/use-finance';
import { spacing } from '@/theme';
import { formatDateTime } from '@/utils/format';

/** FEE-05: payment attempts, newest first. */
export default function PaymentHistoryScreen() {
  const history = usePaymentHistory();

  return (
    <>
      <StackHeader title="Lịch sử thanh toán" />
      <Screen onRefresh={history.refetch} refreshing={history.isRefetching}>
        <QueryView query={history}>
          {(list) =>
            list.length ? (
              list.map((e) => (
                <Card key={e.id} style={styles.row}>
                  <View style={styles.body}>
                    <AppText variant="label" numberOfLines={2}>{e.title}</AppText>
                    <AppText variant="small" color="muted">{[e.provider, formatDateTime(e.at)].filter(Boolean).join(' · ')}</AppText>
                    <StatusChip code={e.status} />
                  </View>
                  <Money amountVnd={e.amount} />
                </Card>
              ))
            ) : (
              <EmptyState icon="history" title="Chưa có giao dịch" />
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
});

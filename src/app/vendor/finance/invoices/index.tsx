import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goTo } from '@/core/navigation/go';
import { useInvoices } from '@/features/finance/use-finance';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

/** FEE-03 */
export default function InvoicesScreen() {
  const invoices = useInvoices();

  return (
    <>
      <StackHeader title="Hoá đơn" />
      <Screen onRefresh={invoices.refetch} refreshing={invoices.isRefetching}>
        <QueryView query={invoices}>
          {(list) =>
            list.length ? (
              list.map((i) => (
                <Card key={i.id} onPress={() => goTo(`/vendor/finance/invoices/${i.id}`)} style={styles.row}>
                  <View style={styles.body}>
                    <AppText variant="label">{i.number}</AppText>
                    <AppText variant="small" color="muted">{i.label} · {formatDate(i.issuedAt)}</AppText>
                  </View>
                  <Money amountVnd={i.amount} />
                </Card>
              ))
            ) : (
              <EmptyState icon="file-document-outline" title="Chưa có hoá đơn" />
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: 2 },
});

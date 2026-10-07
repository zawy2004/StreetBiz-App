import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goTo } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

export default function InvoicesScreen() {
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const invoices = useMockDb((s) => s.invoices).filter((i) => i.vendorId === vendorId);

  return (
    <>
      <StackHeader title="Hoá đơn" />
      <Screen>
        {invoices.length ? (
          invoices.map((i) => (
            <Card key={i.id} onPress={() => goTo(`/vendor/finance/invoices/${i.id}`)} style={styles.row}>
              <View style={styles.body}>
                <AppText variant="label">{i.invoice_number}</AppText>
                <AppText variant="small" color="muted">{formatDate(i.issued_at)}</AppText>
              </View>
              <Money amountVnd={i.amount} />
            </Card>
          ))
        ) : (
          <EmptyState icon="file-document-outline" title="Chưa có hoá đơn" />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: 2 },
});

import { useLocalSearchParams } from 'expo-router';
import { Share } from 'react-native';

import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useMockDb } from '@/mocks/db';
import { formatDateTime, formatVnd } from '@/utils/format';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoice = useMockDb((s) => s.invoices).find((i) => i.id === id);
  const fee = useMockDb((s) => s.feeItems).find((f) => f.id === invoice?.feeItemId);

  if (!invoice) {
    return (
      <>
        <StackHeader title="Hoá đơn" />
        <Screen><EmptyState title="Không tìm thấy hoá đơn" /></Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader title={invoice.invoice_number} />
      <Screen
        footer={
          <Button
            label="Chia sẻ"
            icon="share-variant-outline"
            variant="outline"
            onPress={() => void Share.share({ message: `Hoá đơn ${invoice.invoice_number}: ${formatVnd(invoice.amount)}` })}
          />
        }
      >
        <KeyValueCard
          rows={[
            { label: 'Số hoá đơn', value: invoice.invoice_number },
            { label: 'Khoản', value: fee ? `Phí thuê ô ${fee.period_label}` : 'Phí thuê ô' },
            { label: 'Ngày phát hành', value: formatDateTime(invoice.issued_at) },
            { label: 'Tổng', node: <Money amountVnd={invoice.amount} color="primary" /> },
          ]}
        />
      </Screen>
    </>
  );
}

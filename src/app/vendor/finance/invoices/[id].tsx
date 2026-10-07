import { useLocalSearchParams } from 'expo-router';
import { Share } from 'react-native';

import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useInvoice } from '@/features/finance/use-finance';
import { formatDateTime, formatVnd } from '@/utils/format';

/** FEE-03: one invoice. */
export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoice = useInvoice(id);
  const i = invoice.data;

  return (
    <>
      <StackHeader title={i?.number ?? 'Hoá đơn'} />
      <Screen
        footer={
          i ? (
            <Button
              label="Chia sẻ"
              icon="share-variant-outline"
              variant="outline"
              onPress={() => void Share.share({ message: `Hoá đơn ${i.number}: ${i.label} – ${formatVnd(i.amount)}` })}
            />
          ) : undefined
        }
      >
        <QueryView query={invoice}>
          {(v) =>
            !v ? (
              <EmptyState title="Không tìm thấy hoá đơn" />
            ) : (
              <KeyValueCard
                rows={[
                  { label: 'Số hoá đơn', value: v.number },
                  { label: 'Khoản', value: v.label },
                  ...(v.slotCode ? [{ label: 'Ô', value: v.slotCode }] : []),
                  { label: 'Ngày phát hành', value: formatDateTime(v.issuedAt) },
                  ...(v.provider ? [{ label: 'Thanh toán qua', value: v.provider }] : []),
                  { label: 'Tổng', node: <Money amountVnd={v.amount} color="primary" /> },
                ]}
              />
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

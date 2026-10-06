import { Stack, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { Screen } from '@/components/layout/Screen';
import { SuccessView } from '@/components/layout/SuccessView';
import { goRoot, goTo } from '@/core/navigation/go';
import { formatDateTime } from '@/utils/format';

export default function PaymentSuccessScreen() {
  const { amount, label, code } = useLocalSearchParams<{ amount: string; label: string; code: string }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <Screen
        footer={
          <>
            <Button label="Xem hoá đơn" onPress={() => goTo('/vendor/finance/invoices')} />
            <Button
              label="Về Tài chính"
              variant="outline"
              onPress={() => {
                goRoot('/vendor/finance');
              }}
            />
          </>
        }
      >
        <SuccessView title="Đã thanh toán">
          <Money amountVnd={Number(amount ?? 0)} size="lg" />
        </SuccessView>
        <KeyValueCard
          rows={[
            { label: 'Khoản', value: label ?? '' },
            { label: 'Mã giao dịch', value: code ?? '' },
            { label: 'Thời gian', value: formatDateTime(new Date()) },
          ]}
        />
      </Screen>
    </>
  );
}

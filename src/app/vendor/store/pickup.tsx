import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Money } from '@/components/common/Money';
import { StackHeader } from '@/components/layout/StackHeader';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { useMockDb } from '@/mocks/db';
import type { Order } from '@/mocks/types';
import { QrScanner } from '@/services/qr/QrScanner';
import { spacing } from '@/theme';

export default function PickupScanScreen() {
  const gate = useMarketplaceGate();
  const orders = useMockDb((s) => s.orders);
  const updateStatus = useMockDb((s) => s.updateOrderStatus);
  const [result, setResult] = useState<{ order?: Order; code: string }>();

  function onDetected(code: string) {
    const order = orders.find(
      (o) => o.storefrontId === gate.storefront?.id && o.order_code.toLowerCase() === code.toLowerCase() && o.order_status === 'READY_FOR_PICKUP',
    );
    setResult({ order, code });
  }

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Nhận hàng" />
      {result ? (
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Card style={{ gap: spacing.sm, alignItems: 'center' }}>
            <Icon name={result.order ? 'check-circle' : 'close-circle'} size={48} color={result.order ? 'tertiary' : 'error'} />
            {result.order ? (
              <>
                <AppText variant="title">Đúng đơn #{result.order.order_code}</AppText>
                <Money amountVnd={result.order.total} size="lg" />
              </>
            ) : (
              <>
                <AppText variant="title">Không có đơn sẵn sàng</AppText>
                <AppText color="muted" align="center">Mã {result.code} chưa sẵn sàng hoặc thuộc quán khác</AppText>
              </>
            )}
          </Card>
          {result.order ? (
            <Button
              label="Giao khách"
              onPress={() => {
                updateStatus(result.order!.id, 'COMPLETED');
                router.back();
              }}
            />
          ) : null}
          <Button label="Quét lại" variant="outline" onPress={() => setResult(undefined)} />
        </View>
      ) : (
        <QrScanner hint="Quét mã của khách" onDetected={onDetected} />
      )}
    </View>
  );
}

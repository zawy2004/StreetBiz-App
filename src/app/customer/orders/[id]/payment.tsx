import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Money } from '@/components/common/Money';
import { QrCode } from '@/components/common/QrCode';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goReplace, goRoot } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { spacing, useTheme } from '@/theme';

const WINDOW_SECONDS = 600;

export default function OrderPaymentScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useMockDb((s) => s.orders).find((o) => o.id === id);
  const updateStatus = useMockDb((s) => s.updateOrderStatus);
  const cancel = useMockDb((s) => s.cancelOrder);
  const [left, setLeft] = useState(WINDOW_SECONDS);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  if (!order) {
    return (
      <>
        <StackHeader title="Thanh toán" />
        <Screen><EmptyState title="Không tìm thấy đơn" /></Screen>
      </>
    );
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const method = order.payment_method === 'ZALOPAY' ? 'ZaloPay' : 'MoMo';

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <StackHeader title="Thanh toán" />
      <Screen
        footer={
          <>
            <Button
              label="Mô phỏng đã thanh toán"
              disabled={left <= 0}
              onPress={() => {
                updateStatus(order.id, 'PLACED');
                goReplace(`/customer/orders/${order.id}`);
              }}
            />
            <Button
              label="Huỷ thanh toán"
              variant="outline"
              onPress={() => {
                cancel(order.id);
                goRoot('/customer/orders');
              }}
            />
          </>
        }
      >
        <View style={styles.center}>
          <QrCode value={`PAY-${order.order_code}`} size={220} />
          <Money amountVnd={order.total} size="lg" />
          <AppText color="muted">Mở {method} và quét mã</AppText>
          <StatusChip label={left > 0 ? `Còn ${mm}:${ss}` : 'Hết hạn'} tone={left > 0 ? 'pending' : 'danger'} />
          {left > 0 ? (
            <View style={styles.waiting}>
              <ActivityIndicator color={colors.primary} />
              <AppText color="muted">Đang chờ thanh toán</AppText>
            </View>
          ) : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

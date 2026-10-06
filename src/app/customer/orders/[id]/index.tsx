import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { QrCode } from '@/components/common/QrCode';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { ORDER_STEPS, stepIndex } from '@/features/orders/order-utils';
import { useMockDb } from '@/mocks/db';
import { spacing, useTheme } from '@/theme';

export default function CustomerOrderDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useMockDb((s) => s.orders).find((o) => o.id === id);
  const store = useMockDb((s) => s.storefronts).find((s) => s.id === order?.storefrontId);
  const reviews = useMockDb((s) => s.reviews);
  const cancel = useMockDb((s) => s.cancelOrder);
  const [confirm, setConfirm] = useState(false);

  if (!order) {
    return (
      <>
        <StackHeader title="Đơn hàng" />
        <Screen><EmptyState title="Không tìm thấy đơn" /></Screen>
      </>
    );
  }

  const current = stepIndex(order.order_status);
  const done = order.order_status === 'COMPLETED';
  const reviewed = reviews.some((r) => r.orderId === order.id);
  const showQr = current >= 0 && !done;

  return (
    <>
      <StackHeader title={`Đơn #${order.order_code}`} />
      <Screen
        footer={
          order.order_status === 'PLACED' ? (
            <Button label="Huỷ đơn" variant="danger" onPress={() => setConfirm(true)} />
          ) : done ? (
            <>
              {!reviewed ? <Button label="Đánh giá" onPress={() => goTo(`/customer/orders/${order.id}/review`)} /> : null}
              <Button label="Khiếu nại" variant="outline" onPress={() => goTo(`/customer/orders/${order.id}/complaint`)} />
            </>
          ) : undefined
        }
      >
        <View style={styles.status}>
          <AppText variant="headline">{store?.name}</AppText>
          <StatusChip code={order.order_status} />
        </View>

        {current >= 0 ? (
          <View style={styles.steps}>
            {ORDER_STEPS.map((s, i) => (
              <View key={s.status} style={styles.step}>
                <View style={[styles.bar, { backgroundColor: i <= current ? colors.tertiary : colors.border }]} />
                <AppText variant="small" color={i <= current ? 'tertiary' : 'muted'}>{s.label}</AppText>
              </View>
            ))}
          </View>
        ) : null}

        {showQr ? (
          <Card style={styles.qr}>
            <QrCode value={order.order_code} size={200} />
            <AppText variant="code">{order.order_code}</AppText>
            <AppText variant="small" color="muted">Đưa mã này cho người bán</AppText>
          </Card>
        ) : null}

        <Card style={styles.items}>
          {order.items.map((i) => (
            <View key={i.menuItemId} style={styles.item}>
              <AppText>{i.quantity} × {i.name}</AppText>
              <AppText variant="label">{new Intl.NumberFormat('vi-VN').format(i.price * i.quantity)} đ</AppText>
            </View>
          ))}
          <View style={[styles.item, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }]}>
            <AppText variant="headline">Tổng</AppText>
            <Money amountVnd={order.total} />
          </View>
        </Card>

        {order.pickup_time || order.note ? (
          <KeyValueCard
            rows={[
              ...(order.pickup_time ? [{ label: 'Giờ lấy', value: order.pickup_time }] : []),
              ...(order.note ? [{ label: 'Ghi chú', value: order.note }] : []),
            ]}
          />
        ) : null}

        {done ? (
          <View style={styles.thanks}>
            <Icon name="check-circle" size={20} color="tertiary" />
            <AppText color="muted">Bạn đã nhận món</AppText>
          </View>
        ) : null}
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Huỷ đơn này?"
        description="Quán chưa nhận đơn nên bạn được huỷ miễn phí."
        confirmLabel="Huỷ đơn"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          cancel(order.id);
          setConfirm(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  status: { gap: spacing.sm },
  steps: { flexDirection: 'row', gap: spacing.sm },
  step: { flex: 1, gap: 6 },
  bar: { height: 4, borderRadius: 2 },
  qr: { alignItems: 'center', gap: spacing.sm },
  items: { gap: spacing.md },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thanks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
});

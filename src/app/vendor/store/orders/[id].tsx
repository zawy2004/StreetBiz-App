import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Money } from '@/components/common/Money';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { useMockDb } from '@/mocks/db';
import { spacing, useTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

const NEXT: Record<string, { label: string; to: string } | undefined> = {
  PLACED: { label: 'Nhận đơn', to: 'PREPARING' },
  PREPARING: { label: 'Đã làm xong', to: 'READY_FOR_PICKUP' },
  READY_FOR_PICKUP: { label: 'Giao khách', to: 'COMPLETED' },
};

export default function VendorOrderDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useMockDb((s) => s.orders).find((o) => o.id === id);
  const customer = useMockDb((s) => s.users).find((u) => u.id === order?.customerId);
  const updateStatus = useMockDb((s) => s.updateOrderStatus);
  const [confirmReject, setConfirmReject] = useState(false);

  if (!order) {
    return (
      <>
        <StackHeader title="Đơn hàng" />
        <Screen><EmptyState title="Không tìm thấy đơn" /></Screen>
      </>
    );
  }

  const next = NEXT[order.order_status];

  return (
    <>
      <StackHeader title={`Đơn #${order.order_code}`} />
      <Screen
        footer={
          next ? (
            <>
              <Button label={next.label} onPress={() => updateStatus(order.id, next.to)} />
              {order.order_status === 'PLACED' ? (
                <Button label="Từ chối" variant="danger" onPress={() => setConfirmReject(true)} />
              ) : null}
            </>
          ) : undefined
        }
      >
        <View style={styles.head}>
          <StatusChip code={order.order_status} />
          <AppText variant="small" color="muted">
            {customer?.fullName ?? 'Khách'}{order.pickup_time ? ` · lấy lúc ${order.pickup_time}` : ''}
          </AppText>
          <AppText variant="small" color="muted">{formatDateTime(order.created_at)}</AppText>
        </View>

        <Card style={styles.items}>
          {order.items.map((i) => (
            <View key={i.menuItemId} style={styles.line}>
              <AppText>{i.quantity} × {i.name}</AppText>
              <AppText variant="label">{new Intl.NumberFormat('vi-VN').format(i.price * i.quantity)} đ</AppText>
            </View>
          ))}
          <View style={[styles.line, styles.totalLine, { borderTopColor: colors.border }]}>
            <AppText variant="headline">Tổng</AppText>
            <Money amountVnd={order.total} size="lg" color="primary" />
          </View>
        </Card>

        {order.note ? (
          <Card style={styles.note}>
            <Icon name="note-text-outline" size={20} color="muted" />
            <AppText>{order.note}</AppText>
          </Card>
        ) : null}
      </Screen>
      <ConfirmDialog
        visible={confirmReject}
        title="Từ chối đơn này?"
        description="Khách sẽ được hoàn tiền."
        confirmLabel="Từ chối"
        danger
        onCancel={() => setConfirmReject(false)}
        onConfirm={() => {
          updateStatus(order.id, 'REJECTED');
          setConfirmReject(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  items: { gap: spacing.md },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLine: { borderTopWidth: 1, paddingTop: spacing.md },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

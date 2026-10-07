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
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { statusLabel } from '@/core/constants/status-labels';
import { goTo } from '@/core/navigation/go';
import { ORDER_STEPS, isCollectable, stepIndex } from '@/features/orders/order-utils';
import { useCancelOrder, useMyOrder, useOrderReview, usePickupCode } from '@/features/orders/use-orders';
import { spacing, useTheme } from '@/theme';
import { formatDateTime, formatVnd } from '@/utils/format';

/** ORD-03: one order, with its pickup code while it waits to be collected. */
export default function CustomerOrderDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useMyOrder(id, true);
  const o = order.data;
  const code = usePickupCode(o, Boolean(o && isCollectable(o.status)));
  const review = useOrderReview(o?.status === 'COMPLETED' ? o.id : undefined);
  const cancel = useCancelOrder();
  const [confirm, setConfirm] = useState(false);

  const done = o?.status === 'COMPLETED';
  const reviewed = Boolean(review.data);

  return (
    <>
      <StackHeader title={o ? `Đơn #${o.code.slice(-8)}` : 'Đơn hàng'} />
      <Screen
        onRefresh={order.refetch}
        refreshing={order.isRefetching}
        footer={
          o?.status === 'PLACED' ? (
            <Button label="Huỷ đơn" variant="danger" onPress={() => setConfirm(true)} />
          ) : o?.status === 'PENDING_PAYMENT' ? (
            <Button label="Tiếp tục thanh toán" icon="wallet-outline" onPress={() => goTo(`/customer/orders/${o.id}/payment`)} />
          ) : done && o ? (
            <>
              <Button label={reviewed ? 'Sửa đánh giá' : 'Đánh giá'} icon="star-outline" onPress={() => goTo(`/customer/orders/${o.id}/review`)} />
              <Button label="Khiếu nại" variant="outline" onPress={() => goTo(`/customer/orders/${o.id}/complaint`)} />
            </>
          ) : undefined
        }
      >
        <QueryView query={order}>
          {(data) => {
            if (!data) return <EmptyState title="Không tìm thấy đơn" />;
            const current = stepIndex(data.status);
            return (
              <>
                <View style={styles.status}>
                  <AppText variant="headline">{data.storefrontName}</AppText>
                  <StatusChip code={data.status} />
                </View>

                {current >= 0 ? (
                  <View style={styles.steps}>
                    {ORDER_STEPS.map((s, i) => (
                      <View key={s.status} style={styles.step}>
                        <View style={[styles.bar, { backgroundColor: i <= current ? colors.tertiary : colors.border }]} />
                        <AppText variant="caption" color={i <= current ? 'tertiary' : 'muted'}>{s.label}</AppText>
                      </View>
                    ))}
                  </View>
                ) : null}

                {isCollectable(data.status) ? (
                  <Card style={styles.qr}>
                    <QueryView query={code}>
                      {(c) =>
                        c ? (
                          <>
                            <QrCode value={c.qr} size={200} />
                            <AppText variant="code">{c.shortCode}</AppText>
                            <AppText variant="small" color="muted" align="center">
                              {data.status === 'READY_FOR_PICKUP' ? 'Món đã sẵn sàng. Đưa mã này cho người bán để nhận món.' : 'Đưa mã này cho người bán khi tới lấy món.'}
                            </AppText>
                          </>
                        ) : null
                      }
                    </QueryView>
                  </Card>
                ) : null}

                {data.rejectionReason ? (
                  <Card style={{ backgroundColor: colors.errorBg, borderColor: colors.errorBg }}>
                    <AppText variant="small" color="onError">Quán từ chối: {data.rejectionReason}</AppText>
                  </Card>
                ) : null}

                <Card style={styles.items}>
                  {data.items.map((i) => (
                    <View key={i.id} style={styles.item}>
                      <AppText style={styles.flex}>{i.quantity} × {i.name}</AppText>
                      <AppText variant="label">{formatVnd(i.price * i.quantity)}</AppText>
                    </View>
                  ))}
                  <View style={[styles.item, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }]}>
                    <AppText variant="headline">Tổng</AppText>
                    <Money amountVnd={data.total} />
                  </View>
                </Card>

                <KeyValueCard
                  rows={[
                    { label: 'Đặt lúc', value: formatDateTime(data.createdAt) },
                    ...(data.paymentProvider ? [{ label: 'Thanh toán', value: data.paymentProvider }] : []),
                    ...(data.pickupTime ? [{ label: 'Giờ lấy', value: data.pickupTime }] : []),
                    ...(data.note ? [{ label: 'Ghi chú', value: data.note }] : []),
                    ...(data.refundStatus ? [{ label: 'Hoàn tiền', value: `${statusLabel(data.refundStatus).label}${data.refundAmount ? ` · ${formatVnd(data.refundAmount)}` : ''}` }] : []),
                  ]}
                />

                {data.history.length ? (
                  <Section title="Lịch sử đơn">
                    <Card style={styles.history}>
                      {data.history.map((h, i) => (
                        <View key={`${h.status}-${i}`} style={styles.historyRow}>
                          <Icon name="circle-medium" size={20} color={i === data.history.length - 1 ? 'primary' : 'muted'} />
                          <View style={styles.flex}>
                            <AppText variant="labelSm">{statusLabel(h.status).label}</AppText>
                            {h.note ? <AppText variant="caption" color="muted">{h.note}</AppText> : null}
                          </View>
                          <AppText variant="caption" color="muted">{formatDateTime(h.at)}</AppText>
                        </View>
                      ))}
                    </Card>
                  </Section>
                ) : null}

                {done ? (
                  <View style={styles.thanks}>
                    <Icon name="check-circle" size={20} color="tertiary" />
                    <AppText color="muted">Bạn đã nhận món</AppText>
                  </View>
                ) : null}
              </>
            );
          }}
        </QueryView>
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Huỷ đơn này?"
        description="Quán chưa nhận đơn nên bạn được huỷ và hoàn tiền."
        confirmLabel="Huỷ đơn"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          if (o) cancel.mutateAsync(o.id).then(() => showToast('Đã huỷ đơn'), showError);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  status: { gap: spacing.sm },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, gap: 6 },
  bar: { height: 4, borderRadius: 2 },
  qr: { alignItems: 'center', gap: spacing.sm },
  items: { gap: spacing.md },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  history: { gap: spacing.md },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  thanks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' },
});

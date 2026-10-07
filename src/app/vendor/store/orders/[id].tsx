import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { isLiveApi } from '@/core/config/env';
import { goTo } from '@/core/navigation/go';
import { useSellerOrderAction, useVendorOrder, type SellerAction } from '@/features/orders/use-orders';
import { spacing, useTheme } from '@/theme';
import { formatDateTime, formatVnd } from '@/utils/format';

/**
 * The next step for each status. Live, a READY order is completed only by
 * the buyer's pickup code (ORD-06); the demo lets the seller hand it over.
 */
const NEXT: Record<string, { label: string; action: SellerAction } | undefined> = {
  PLACED: { label: 'Nhận đơn', action: 'accept' },
  ACCEPTED: { label: 'Bắt đầu làm', action: 'preparing' },
  PREPARING: { label: 'Đã làm xong', action: 'ready' },
  READY_FOR_PICKUP: isLiveApi ? undefined : { label: 'Giao khách', action: 'handover' },
};

/** SORD-02/03: one order and its next step. */
export default function VendorOrderDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useVendorOrder(id);
  const act = useSellerOrderAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const o = order.data;
  const next = o ? NEXT[o.status] : undefined;

  const run = (action: SellerAction, done: string, why?: string) =>
    o ? act.mutateAsync({ orderId: o.id, action, reason: why }).then(() => showToast(done), showError) : undefined;

  return (
    <>
      <StackHeader title={o ? `Đơn #${o.code.slice(-8)}` : 'Đơn hàng'} />
      <Screen
        onRefresh={order.refetch}
        refreshing={order.isRefetching}
        footer={
          o ? (
            next ? (
              <>
                <Button label={next.label} loading={act.isPending} onPress={() => void run(next.action, 'Đã cập nhật đơn')} />
                {o.status === 'PLACED' ? <Button label="Từ chối" variant="danger" disabled={act.isPending} onPress={() => setRejecting(true)} /> : null}
              </>
            ) : o.status === 'READY_FOR_PICKUP' ? (
              <Button label="Quét mã của khách để giao" icon="qrcode-scan" onPress={() => goTo('/vendor/store/pickup')} />
            ) : undefined
          ) : undefined
        }
      >
        <QueryView query={order}>
          {(v) =>
            !v ? (
              <EmptyState title="Không tìm thấy đơn" />
            ) : (
              <>
                <View style={styles.head}>
                  <StatusChip code={v.status} />
                  <AppText variant="small" color="muted">
                    {v.customerName ?? 'Khách'}{v.pickupTime ? ` · lấy lúc ${v.pickupTime}` : ''} · {v.storefrontName}
                  </AppText>
                  <AppText variant="small" color="muted">{formatDateTime(v.createdAt)}</AppText>
                </View>

                <Card style={styles.items}>
                  {v.items.map((i) => (
                    <View key={i.id} style={styles.line}>
                      <View style={styles.flex}>
                        <AppText>{i.quantity} × {i.name}</AppText>
                        {i.note ? <AppText variant="caption" color="muted">{i.note}</AppText> : null}
                      </View>
                      <AppText variant="label">{formatVnd(i.price * i.quantity)}</AppText>
                    </View>
                  ))}
                  <View style={[styles.line, styles.totalLine, { borderTopColor: colors.border }]}>
                    <AppText variant="headline">Tổng</AppText>
                    <Money amountVnd={v.total} size="lg" color="primary" />
                  </View>
                </Card>

                {v.note ? (
                  <Card style={styles.note}>
                    <Icon name="note-text-outline" size={20} color="muted" />
                    <AppText>{v.note}</AppText>
                  </Card>
                ) : null}

                <KeyValueCard
                  rows={[
                    ...(v.paymentProvider ? [{ label: 'Thanh toán', value: `${v.paymentProvider}${v.paymentStatus ? ` · ${v.paymentStatus}` : ''}` }] : []),
                    ...(v.rejectionReason ? [{ label: 'Lý do từ chối', value: v.rejectionReason }] : []),
                  ]}
                />
              </>
            )
          }
        </QueryView>
      </Screen>
      <ConfirmDialog
        visible={rejecting}
        title="Từ chối đơn này?"
        description="Khách sẽ được hoàn tiền. Lý do được gửi cho khách."
        confirmLabel="Từ chối"
        danger
        onCancel={() => setRejecting(false)}
        onConfirm={() => {
          setRejecting(false);
          void run('reject', 'Đã từ chối đơn', reason.trim() || 'Quán hết món hoặc không thể phục vụ lúc này');
        }}
      >
        <TextField label="Lý do (gửi cho khách)" value={reason} onChangeText={setReason} placeholder="Hết món, quán đóng sớm…" />
      </ConfirmDialog>
    </>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  items: { gap: spacing.md },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  totalLine: { borderTopWidth: 1, paddingTop: spacing.md },
  note: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

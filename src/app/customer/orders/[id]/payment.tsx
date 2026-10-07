import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Money } from '@/components/common/Money';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { env, isDev, isLiveApi } from '@/core/config/env';
import { goReplace, goTo } from '@/core/navigation/go';
import { useCancelOrder, useMyOrder, usePaymentOptions, useSandboxPay, useSyncPayment } from '@/features/orders/use-orders';
import { spacing, useTheme } from '@/theme';

/**
 * ORD-01 payment. The order only counts once StreetBiz-BE has seen the payment
 * (provider callback, `sync` when the buyer comes back, or the Development
 * sandbox); nothing on the device is trusted as proof.
 */
export default function OrderPaymentScreen() {
  const { colors } = useTheme();
  const { id, url } = useLocalSearchParams<{ id: string; url?: string }>();
  const order = useMyOrder(id, true);
  const options = usePaymentOptions();
  const sandbox = useSandboxPay();
  const sync = useSyncPayment();
  const cancel = useCancelOrder();
  const o = order.data;

  const pending = o?.status === 'PENDING_PAYMENT';
  const viaGateway = isLiveApi && options.data?.mode === 'LIVE' && Boolean(url);
  const showSandbox = !isLiveApi || (isDev && env.enablePaymentSandbox && !viaGateway);

  // Coming back from the payment app: ask the backend once to check with the provider.
  const syncing = useRef(false);
  const syncNow = sync.mutateAsync;
  useEffect(() => {
    if (!isLiveApi || !id) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || syncing.current) return;
      syncing.current = true;
      syncNow(id)
        .catch(() => undefined)
        .finally(() => {
          syncing.current = false;
        });
    });
    return () => sub.remove();
  }, [id, syncNow]);

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      showToast(done);
    } catch (e) {
      showError(e);
    }
  }

  const busy = sandbox.isPending || sync.isPending || cancel.isPending;

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <StackHeader title="Thanh toán" />
      <Screen
        footer={
          o ? (
            pending ? (
              <>
                {viaGateway ? <Button label="Mở trang thanh toán" icon="open-in-new" onPress={() => void Linking.openURL(url!)} /> : null}
                {showSandbox ? (
                  <Button
                    label={isLiveApi ? 'Thanh toán thử (thành công)' : 'Mô phỏng đã thanh toán'}
                    loading={sandbox.isPending}
                    disabled={busy}
                    onPress={() => void run(() => sandbox.mutateAsync({ orderId: o.id, outcome: 'success' }), 'Thanh toán thành công')}
                  />
                ) : null}
                {isLiveApi ? (
                  <Button label="Kiểm tra lại" variant="outline" icon="refresh" loading={sync.isPending} disabled={busy} onPress={() => void run(() => sync.mutateAsync(o.id), 'Đã kiểm tra với cổng thanh toán')} />
                ) : null}
                <Button
                  label="Huỷ đơn này"
                  variant="ghost"
                  loading={cancel.isPending}
                  disabled={busy}
                  onPress={() => void run(() => cancel.mutateAsync(o.id), 'Đã huỷ đơn')}
                />
              </>
            ) : (
              <>
                <Button label="Xem đơn hàng" onPress={() => goReplace(`/customer/orders/${o.id}`)} />
                {o.status === 'CANCELLED' ? <Button label="Về giỏ hàng" variant="outline" onPress={() => goTo('/customer/cart')} /> : null}
              </>
            )
          ) : undefined
        }
      >
        <QueryView query={order}>
          {(data) =>
            !data ? (
              <EmptyState title="Không tìm thấy đơn" />
            ) : (
              <>
                <Card style={styles.summary}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <AppText variant="headline">{data.storefrontName}</AppText>
                      <AppText variant="small" color="muted">#{data.code}{data.paymentProvider ? ` · ${data.paymentProvider}` : ''}</AppText>
                    </View>
                    <StatusChip code={data.status} />
                  </View>
                  <Money amountVnd={data.total} size="lg" color="primary" />
                </Card>

                <Card style={styles.state}>
                  {pending ? (
                    <>
                      <View style={styles.row}>
                        <ActivityIndicator color={colors.primary} />
                        <AppText variant="headline">Đang chờ xác nhận thanh toán</AppText>
                      </View>
                      <AppText color="muted">
                        {viaGateway
                          ? 'Thanh toán trên trang của cổng thanh toán, rồi quay lại đây. Ứng dụng sẽ tự hỏi lại kết quả.'
                          : showSandbox
                            ? 'Môi trường thử nghiệm chưa nối cổng thanh toán thật. Bấm "Thanh toán thử" để hoàn tất.'
                            : 'Trang này tự cập nhật khi hệ thống nhận được kết quả thanh toán.'}
                      </AppText>
                      <AppText variant="caption" color="muted">Giỏ hàng bị khoá cho tới khi đơn được thanh toán hoặc huỷ.</AppText>
                    </>
                  ) : data.status === 'CANCELLED' ? (
                    <View style={styles.row}>
                      <Icon name="close-circle" size={24} color="error" />
                      <AppText variant="headline" color="error">Thanh toán thất bại hoặc đơn đã huỷ</AppText>
                    </View>
                  ) : (
                    <>
                      <View style={styles.row}>
                        <Icon name="check-circle" size={24} color="tertiary" />
                        <AppText variant="headline" color="tertiary">Đặt món thành công</AppText>
                      </View>
                      <AppText color="muted">Quán đã nhận được đơn. Mở đơn hàng để xem mã nhận món.</AppText>
                    </>
                  )}
                </Card>
              </>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.sm },
  state: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});

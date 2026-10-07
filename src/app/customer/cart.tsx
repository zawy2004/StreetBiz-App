import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError } from '@/components/feedback/Toast';
import { QuantityStepper } from '@/components/forms/QuantityStepper';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { requireAuth } from '@/core/auth/require-auth';
import { goReplace, goTo } from '@/core/navigation/go';
import { useCartView, useSetCartQuantity } from '@/features/cart/use-cart';
import { spacing, useTheme } from '@/theme';

export default function CartScreen() {
  const { colors } = useTheme();
  const cart = useCartView();
  const setQuantity = useSetCartQuantity();
  const c = cart.data;
  const locked = Boolean(c?.pendingOrderId);
  const blocked = c?.lines.some((l) => l.soldOut);

  return (
    <>
      <StackHeader title="Giỏ hàng" />
      <Screen
        onRefresh={cart.refetch}
        refreshing={cart.isRefetching}
        footer={
          c?.lines.length ? (
            locked ? (
              <Button label="Tiếp tục thanh toán" icon="wallet-outline" onPress={() => goTo(`/customer/orders/${c.pendingOrderId}/payment`)} />
            ) : (
              <Button
                label="Đặt món"
                icon="arrow-right"
                disabled={blocked}
                onPress={() => requireAuth('/customer/checkout') && goTo('/customer/checkout')}
              />
            )
          ) : undefined
        }
      >
        <QueryView query={cart}>
          {(view) =>
            view.lines.length ? (
              <>
                <AppText variant="headline">{view.storefrontName}</AppText>
                {locked ? (
                  <Card style={{ backgroundColor: colors.secondaryBg, borderColor: colors.secondaryBg }}>
                    <AppText variant="small" color="onSecondary">Giỏ này có một đơn đang chờ thanh toán. Thanh toán hoặc huỷ đơn đó để sửa giỏ.</AppText>
                  </Card>
                ) : null}
                {view.lines.map((l) => (
                  <Card key={l.menuItemId} style={styles.row}>
                    <Thumb size={56} seed={l.menuItemId} uri={l.imageUrl} />
                    <View style={styles.body}>
                      <AppText variant="label">{l.name}</AppText>
                      <Money amountVnd={l.subtotal} />
                      {l.soldOut ? <StatusChip code="SOLD_OUT" /> : null}
                      {l.note ? <AppText variant="small" color="muted">{l.note}</AppText> : null}
                    </View>
                    {locked ? (
                      <AppText variant="label">× {l.quantity}</AppText>
                    ) : (
                      <QuantityStepper
                        value={l.quantity}
                        onChange={(q) => setQuantity.mutateAsync({ menuItemId: l.menuItemId, quantity: q, note: l.note }).catch(showError)}
                      />
                    )}
                  </Card>
                ))}
                {blocked ? <AppText variant="small" color="error">Có món đã hết, bỏ món đó ra để đặt.</AppText> : null}
                <View style={styles.total}>
                  <AppText variant="headline">Tổng</AppText>
                  <Money amountVnd={view.total} size="lg" color="primary" />
                </View>
              </>
            ) : (
              <EmptyState icon="cart-outline" tone="primary" title="Giỏ hàng trống" description="Chọn món ở trang gian hàng rồi quay lại đây để đặt.">
                <Button label="Xem quán" variant="soft" onPress={() => goReplace('/customer/explore')} />
              </EmptyState>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: 2 },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

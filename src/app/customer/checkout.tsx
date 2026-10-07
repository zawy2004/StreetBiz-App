import dayjs from 'dayjs';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { QueryView } from '@/components/feedback/States';
import { showError } from '@/components/feedback/Toast';
import { RadioRow } from '@/components/forms/Choices';
import { FilterChips } from '@/components/forms/FilterChips';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { isLiveApi } from '@/core/config/env';
import { goReplace } from '@/core/navigation/go';
import { useCartView } from '@/features/cart/use-cart';
import { PAY_METHODS } from '@/features/orders/order-utils';
import { usePaymentOptions, useCheckout } from '@/features/orders/use-orders';
import { spacing } from '@/theme';
import { formatVnd } from '@/utils/format';

/** CART-02: confirm the cart and pick how to pay; payment happens on the next screen. */
export default function CheckoutScreen() {
  const cart = useCartView();
  const options = usePaymentOptions();
  const checkout = useCheckout();

  const [times] = useState(() => [15, 30, 45, 60].map((m) => dayjs().add(m, 'minute').format('HH:mm')));
  const [time, setTime] = useState(times[1]!);
  const [method, setMethod] = useState<'MOMO' | 'ZALOPAY'>('MOMO');
  const [note, setNote] = useState('');

  const c = cart.data;
  const providers = PAY_METHODS.filter((m) => options.data?.providers.includes(m.value) ?? true);
  const unavailable = options.data?.mode === 'UNAVAILABLE';

  async function pay() {
    if (!c) return;
    try {
      const result = await checkout.mutateAsync({ cartId: c.cartId, provider: method, pickupTime: time, note: note.trim() || undefined });
      const q = result.paymentUrl ? `?url=${encodeURIComponent(result.paymentUrl)}` : '';
      goReplace(`/customer/orders/${result.orderId}/payment${q}`);
    } catch (e) {
      showError(e);
    }
  }

  return (
    <>
      <StackHeader title="Xác nhận" />
      <Screen
        footer={
          <Button
            label={`Thanh toán ${formatVnd(c?.total ?? 0)}`}
            icon="lock-outline"
            disabled={!c?.lines.length || unavailable}
            loading={checkout.isPending}
            onPress={() => void pay()}
          />
        }
      >
        <QueryView query={cart}>
          {(view) => (
            <>
              <KeyValueCard
                rows={[
                  { label: 'Quán', value: view.storefrontName ?? '' },
                  { label: 'Số món', value: String(view.count) },
                  { label: 'Nhận món', value: 'Tự đến quầy lấy' },
                ]}
              />

              {!isLiveApi ? (
                <View style={styles.block}>
                  <AppText variant="labelSm">Giờ lấy món</AppText>
                  <FilterChips options={times.map((t) => ({ value: t, label: t }))} selected={[time]} onToggle={setTime} />
                </View>
              ) : null}

              <View style={styles.block}>
                <AppText variant="labelSm">Phương thức</AppText>
                {providers.map((m) => (
                  <RadioRow key={m.value} label={m.label} selected={m.value === method} onPress={() => setMethod(m.value)} />
                ))}
                {options.data?.message ? <AppText variant="caption" color="muted">{options.data.message}</AppText> : null}
              </View>

              {!isLiveApi ? <TextField label="Ghi chú cho quán" placeholder="Không bắt buộc" value={note} onChangeText={setNote} /> : null}

              <Card style={styles.total}>
                <AppText variant="headline">Tổng</AppText>
                <Money amountVnd={view.total} size="lg" color="primary" />
              </Card>
            </>
          )}
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

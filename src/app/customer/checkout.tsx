import dayjs from 'dayjs';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { FilterChips } from '@/components/forms/FilterChips';
import { RadioRow } from '@/components/forms/Choices';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goReplace } from '@/core/navigation/go';
import { useCart } from '@/features/cart/cart-store';
import { useCartSummary } from '@/features/cart/useCartSummary';
import { PAY_METHODS } from '@/features/orders/order-utils';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';
import { formatVnd } from '@/utils/format';

export default function CheckoutScreen() {
  const user = useAuthStore((s) => s.user);
  const { lines, storefrontId, total } = useCartSummary();
  const clear = useCart((s) => s.clear);
  const store = useMockDb((s) => s.storefronts).find((s) => s.id === storefrontId);
  const placeOrder = useMockDb((s) => s.placeOrder);
  const updateStatus = useMockDb((s) => s.updateOrderStatus);

  const [times] = useState(() => [15, 30, 45, 60].map((m) => dayjs().add(m, 'minute').format('HH:mm')));
  const [time, setTime] = useState(times[1]!);
  const [method, setMethod] = useState('MOMO');
  const [note, setNote] = useState('');

  function pay() {
    if (!user || !storefrontId) return;
    const order = placeOrder({
      customerId: user.id,
      storefrontId,
      items: lines.map((l) => ({ menuItemId: l.menuItemId, name: l.item.name, price: l.item.price, quantity: l.quantity })),
      total,
      pickup_time: time,
      note: note.trim() || undefined,
      payment_method: method,
    });
    updateStatus(order.id, 'PENDING_PAYMENT');
    clear();
    goReplace(`/customer/orders/${order.id}/payment`);
  }

  return (
    <>
      <StackHeader title="Xác nhận" />
      <Screen footer={<Button label={`Thanh toán ${formatVnd(total)}`} disabled={!lines.length} onPress={pay} />}>
        <KeyValueCard rows={[{ label: 'Quán', value: store?.name ?? '' }, { label: 'Số món', value: String(lines.reduce((n, l) => n + l.quantity, 0)) }]} />

        <View style={styles.block}>
          <AppText variant="labelSm">Giờ lấy món</AppText>
          <FilterChips options={times.map((t) => ({ value: t, label: t }))} selected={[time]} onToggle={setTime} />
        </View>

        <View style={styles.block}>
          <AppText variant="labelSm">Phương thức</AppText>
          {PAY_METHODS.map((m) => (
            <RadioRow key={m.value} label={m.label} selected={m.value === method} onPress={() => setMethod(m.value)} />
          ))}
        </View>

        <TextField label="Ghi chú cho quán" placeholder="Không bắt buộc" value={note} onChangeText={setNote} />

        <Card style={styles.total}>
          <AppText variant="headline">Tổng</AppText>
          <Money amountVnd={total} size="lg" color="primary" />
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

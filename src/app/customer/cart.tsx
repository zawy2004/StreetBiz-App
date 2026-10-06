import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState } from '@/components/feedback/States';
import { QuantityStepper } from '@/components/forms/QuantityStepper';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { requireAuth } from '@/core/auth/require-auth';
import { goReplace, goTo } from '@/core/navigation/go';
import { useCart } from '@/features/cart/cart-store';
import { useCartSummary } from '@/features/cart/useCartSummary';
import { useMockDb } from '@/mocks/db';
import { spacing } from '@/theme';

export default function CartScreen() {
  const { lines, storefrontId, total } = useCartSummary();
  const setQuantity = useCart((s) => s.setQuantity);
  const store = useMockDb((s) => s.storefronts).find((s) => s.id === storefrontId);

  return (
    <>
      <StackHeader title="Giỏ hàng" />
      <Screen
        footer={
          lines.length ? (
            <Button label="Đặt món" onPress={() => requireAuth() && goTo('/customer/checkout')} />
          ) : undefined
        }
      >
        {lines.length ? (
          <>
            <AppText variant="headline">{store?.name}</AppText>
            {lines.map((l) => (
              <Card key={l.menuItemId} style={styles.row}>
                <Thumb size={56} />
                <View style={styles.body}>
                  <AppText variant="label">{l.item.name}</AppText>
                  <Money amountVnd={l.subtotal} />
                  {l.note ? <AppText variant="small" color="muted">{l.note}</AppText> : null}
                </View>
                <QuantityStepper value={l.quantity} onChange={(q) => setQuantity(l.menuItemId, q)} />
              </Card>
            ))}
            <View style={styles.total}>
              <AppText variant="headline">Tổng</AppText>
              <Money amountVnd={total} size="lg" color="primary" />
            </View>
          </>
        ) : (
          <>
            <EmptyState icon="cart-outline" title="Giỏ hàng trống" />
            <Button label="Xem quán" onPress={() => goReplace('/customer/explore')} />
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: 2 },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

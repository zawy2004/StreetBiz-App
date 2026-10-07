import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Money } from '@/components/common/Money';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState } from '@/components/feedback/States';
import { QuantityStepper } from '@/components/forms/QuantityStepper';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { useCart } from '@/features/cart/cart-store';
import { useMockDb } from '@/mocks/db';
import { spacing } from '@/theme';
import { formatVnd } from '@/utils/format';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useMockDb((s) => s.menuItems).find((m) => m.id === id);
  const add = useCart((s) => s.add);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  if (!item) {
    return (
      <>
        <StackHeader title="Món" />
        <Screen><EmptyState title="Không tìm thấy món" /></Screen>
      </>
    );
  }

  const soldOut = item.availability_status === 'SOLD_OUT';

  return (
    <>
      <StackHeader title={item.name} />
      <Screen
        footer={
          <Button
            label={soldOut ? 'Hết món' : `Thêm vào giỏ · ${formatVnd(item.price * quantity)}`}
            disabled={soldOut}
            onPress={() => {
              add(item, quantity, note.trim() || undefined);
              router.back();
            }}
          />
        }
      >
        <Thumb size={160} />
        <View style={styles.head}>
          <AppText variant="title">{item.name}</AppText>
          {soldOut ? <StatusChip code="SOLD_OUT" /> : null}
        </View>
        <Money amountVnd={item.price} size="lg" color="primary" />
        <AppText color="muted">{item.description}</AppText>
        <View style={styles.qty}>
          <AppText variant="label">Số lượng</AppText>
          <QuantityStepper value={quantity} min={1} onChange={setQuantity} />
        </View>
        <TextField label="Ghi chú" placeholder="Ít cay, không hành" value={note} onChangeText={setNote} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

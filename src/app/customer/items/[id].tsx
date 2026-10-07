import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Money } from '@/components/common/Money';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { QuantityStepper } from '@/components/forms/QuantityStepper';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { canUseCart, useAddToCart } from '@/features/cart/use-cart';
import { useMenuItem } from '@/features/discovery/use-discovery';
import { spacing } from '@/theme';
import { formatVnd } from '@/utils/format';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useMenuItem(id);
  const add = useAddToCart();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const m = item.data;

  async function addToCart() {
    if (!m || !canUseCart(`/customer/items/${id}`)) return;
    try {
      await add.mutateAsync({ item: m, quantity, note: note.trim() || undefined });
      showToast(`Đã thêm ${quantity} × ${m.name}`);
      router.back();
    } catch (e) {
      showError(e);
    }
  }

  return (
    <>
      <StackHeader title={m?.name ?? 'Món'} />
      <Screen
        footer={
          m ? (
            <Button
              label={m.soldOut ? 'Hết món' : `Thêm vào giỏ · ${formatVnd(m.price * quantity)}`}
              icon="cart-plus"
              disabled={m.soldOut}
              loading={add.isPending}
              onPress={() => void addToCart()}
            />
          ) : undefined
        }
      >
        <QueryView query={item}>
          {(it) =>
            !it ? (
              <EmptyState title="Không tìm thấy món" />
            ) : (
              <>
                <View style={styles.art}>
                  <Thumb size={180} seed={it.id} uri={it.imageUrl} />
                </View>
                <View style={styles.head}>
                  <AppText variant="title" style={styles.name}>{it.name}</AppText>
                  {it.soldOut ? <StatusChip code="SOLD_OUT" /> : null}
                </View>
                <AppText variant="small" color="muted">{[it.storefrontName, it.categoryName].filter(Boolean).join(' · ')}</AppText>
                <Money amountVnd={it.price} size="lg" color="primary" />
                {it.description ? <AppText color="muted">{it.description}</AppText> : null}
                <View style={styles.qty}>
                  <AppText variant="label">Số lượng</AppText>
                  <QuantityStepper value={quantity} min={1} onChange={setQuantity} />
                </View>
                <TextField label="Ghi chú" placeholder="Ít cay, không hành" value={note} onChangeText={setNote} />
              </>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { flex: 1 },
  qty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

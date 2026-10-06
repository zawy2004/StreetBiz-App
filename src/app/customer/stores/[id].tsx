import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Money } from '@/components/common/Money';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState } from '@/components/feedback/States';
import { RatingStars } from '@/components/forms/RatingStars';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { HeaderIconButton } from '@/components/layout/AppHeader';
import { requireAuth } from '@/core/auth/require-auth';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { CartBar } from '@/features/cart/CartBar';
import { useCart } from '@/features/cart/cart-store';
import { useCartSummary } from '@/features/cart/useCartSummary';
import { formatRating } from '@/features/discovery/useActiveVendors';
import { useMockDb } from '@/mocks/db';
import { radius, spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

export default function StorefrontDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useMockDb((s) => s.storefronts).find((s) => s.id === id);
  const items = useMockDb((s) => s.menuItems).filter((m) => m.storefrontId === id);
  const reviews = useMockDb((s) => s.reviews).filter((r) => r.storefrontId === id);
  const add = useCart((s) => s.add);
  const { count } = useCartSummary();
  const [tab, setTab] = useState<'menu' | 'reviews'>('menu');

  if (!store) {
    return (
      <>
        <StackHeader title="Gian hàng" />
        <Screen><EmptyState title="Không tìm thấy gian hàng" /></Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader
        title={store.name}
        right={
          <HeaderIconButton
            icon="message-text-outline"
            label="Nhắn tin cho quán"
            onPress={() => requireAuth() && goTo(`/customer/chat/${store.id}`)}
          />
        }
      />
      <Screen footer={count ? <CartBar /> : undefined}>
        <View style={styles.head}>
          <Thumb size={72} />
          <View style={styles.headBody}>
            <AppText variant="title">{store.name}</AppText>
            <StatusChip code={store.availability_status === 'OPEN' ? 'OPEN' : 'CLOSED'} />
            <AppText variant="small" color="muted">★ {formatRating(store.ratingAvg)} · {store.openTime} - {store.closeTime}</AppText>
          </View>
        </View>

        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'menu', label: 'Thực đơn' },
            { value: 'reviews', label: 'Đánh giá' },
          ]}
        />

        {tab === 'menu' ? (
          items.length ? (
            items.map((m) => {
              const soldOut = m.availability_status === 'SOLD_OUT';
              return (
                <Card key={m.id} style={styles.item}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={m.name}
                    onPress={() => goTo(`/customer/items/${m.id}`)}
                    style={styles.itemMain}
                  >
                    <Thumb size={72} />
                    <View style={styles.itemBody}>
                      <AppText variant="label">{m.name}</AppText>
                      <Money amountVnd={m.price} />
                      {soldOut ? <StatusChip code="SOLD_OUT" /> : null}
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Thêm ${m.name}`}
                    disabled={soldOut || store.availability_status !== 'OPEN'}
                    onPress={() => add(m)}
                    style={[styles.plus, { backgroundColor: colors.primary, opacity: soldOut || store.availability_status !== 'OPEN' ? 0.35 : 1 }]}
                  >
                    <Icon name="plus" size={22} color="onPrimary" />
                  </Pressable>
                </Card>
              );
            })
          ) : (
            <EmptyState icon="food-off" title="Chưa có món" />
          )
        ) : reviews.length ? (
          reviews.map((r) => (
            <Card key={r.id} style={styles.review}>
              <RatingStars value={r.rating} size={18} />
              <AppText>{r.text}</AppText>
              <AppText variant="small" color="muted">{formatDate(r.created_at)}</AppText>
            </Card>
          ))
        ) : (
          <EmptyState icon="comment-text-outline" title="Chưa có đánh giá" />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headBody: { flex: 1, gap: spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemBody: { flex: 1, gap: spacing.xs },
  plus: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  review: { gap: spacing.sm },
});

import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { HeroCard } from '@/components/common/HeroCard';
import { Icon, type IconName } from '@/components/common/Icon';
import { Money } from '@/components/common/Money';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { HeaderIconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { requireAuth } from '@/core/auth/require-auth';
import { goTo } from '@/core/navigation/go';
import { CartBar } from '@/features/cart/CartBar';
import { canUseCart, useAddToCart, useCartView } from '@/features/cart/use-cart';
import { ReviewCard } from '@/features/discovery/ReviewCard';
import { useStoreReviews, useStorefront, type MenuItemView } from '@/features/discovery/use-discovery';
import { formatRating } from '@/features/discovery/useActiveVendors';
import { radius, spacing, useTheme } from '@/theme';

/** CART-01: a storefront's menu, ordered for pickup. */
export default function StorefrontDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStorefront(id);
  const reviews = useStoreReviews(id, store.data?.vendorId);
  const add = useAddToCart();
  const cartCount = useCartView().data?.count ?? 0;
  const [tab, setTab] = useState<'menu' | 'reviews'>('menu');
  const s = store.data;

  async function addItem(item: MenuItemView) {
    if (!canUseCart(`/customer/stores/${id}`)) return;
    try {
      await add.mutateAsync({ item, quantity: 1 });
      showToast(`Đã thêm ${item.name}`);
    } catch (e) {
      showError(e);
    }
  }

  return (
    <>
      <StackHeader
        title={s?.name ?? 'Gian hàng'}
        right={
          s ? (
            <HeaderIconButton
              icon="message-text-outline"
              label="Nhắn tin cho quán"
              onPress={() => requireAuth(`/customer/chat/${s.id}`) && goTo(`/customer/chat/${s.id}`)}
            />
          ) : undefined
        }
      />
      <Screen footer={cartCount ? <CartBar /> : undefined} onRefresh={store.refetch} refreshing={store.isRefetching}>
        <QueryView query={store}>
          {(st) =>
            !st ? (
              <EmptyState title="Không tìm thấy gian hàng" />
            ) : (
              <>
                <HeroCard accent={st.status === 'OPEN' ? 'brand' : 'amber'}>
                  <View style={styles.head}>
                    <Thumb size={64} seed={st.id} icon="storefront-outline" />
                    <View style={styles.headBody}>
                      <AppText variant="title" style={{ color: colors.onHero }}>{st.name}</AppText>
                      <StatusChip code={st.status} />
                    </View>
                  </View>
                  {st.description ? <AppText style={{ color: colors.heroMuted }}>{st.description}</AppText> : null}
                  <View style={styles.facts}>
                    <Fact icon="star" text={st.rating !== null ? `${formatRating(st.rating)} (${st.ratingCount})` : 'Chưa có đánh giá'} />
                    {st.hours ? <Fact icon="clock-outline" text={st.hours} /> : null}
                    <Fact icon="shopping-outline" text="Tự đến lấy" />
                  </View>
                </HeroCard>

                <SegmentedControl
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'menu', label: 'Thực đơn' },
                    { value: 'reviews', label: 'Đánh giá' },
                  ]}
                />

                {tab === 'menu' ? (
                  st.menu.some((g) => g.items.length) ? (
                    st.menu.map((group) =>
                      group.items.length ? (
                        <Section key={group.category} title={group.category}>
                          {group.items.map((m) => (
                            <MenuRow key={m.id} item={m} canOrder={st.status === 'OPEN'} onAdd={() => void addItem(m)} />
                          ))}
                        </Section>
                      ) : null,
                    )
                  ) : (
                    <EmptyState icon="food-off" title="Chưa có món" />
                  )
                ) : (
                  <QueryView query={reviews}>
                    {(list) => (list.length ? list.map((r) => <ReviewCard key={r.id} review={r} />) : <EmptyState icon="comment-text-outline" title="Chưa có đánh giá" />)}
                  </QueryView>
                )}
              </>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

function MenuRow({ item, canOrder, onAdd }: { item: MenuItemView; canOrder: boolean; onAdd: () => void }) {
  const { colors } = useTheme();
  const disabled = item.soldOut || !canOrder;
  return (
    <Card style={styles.item}>
      <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => goTo(`/customer/items/${item.id}`)} style={styles.itemMain}>
        <Thumb size={72} seed={item.id} uri={item.imageUrl} />
        <View style={styles.itemBody}>
          <AppText variant="label">{item.name}</AppText>
          {item.description ? <AppText variant="caption" color="muted" numberOfLines={2}>{item.description}</AppText> : null}
          <Money amountVnd={item.price} />
          {item.soldOut ? <StatusChip code="SOLD_OUT" /> : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Thêm ${item.name}`}
        disabled={disabled}
        onPress={onAdd}
        style={[styles.plus, { backgroundColor: colors.primary, opacity: disabled ? 0.35 : 1 }]}
      >
        <Icon name="plus" size={22} color="onPrimary" />
      </Pressable>
    </Card>
  );
}

/** Small icon + text fact on a hero card (rating, opening hours...). */
function Fact({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fact, { borderColor: colors.heroLine }]}>
      <Icon name={icon} size={15} color="#FFB547" />
      <AppText variant="caption" style={{ color: colors.onHero }}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headBody: { flex: 1, gap: spacing.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.05)' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemBody: { flex: 1, gap: spacing.xs },
  plus: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});

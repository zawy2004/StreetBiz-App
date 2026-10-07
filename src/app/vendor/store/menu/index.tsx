import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useSaveMenuItem, useSellerMenu, type SellerItem } from '@/features/storefront/use-store';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { spacing, useTheme } from '@/theme';

const FOOD_SAFETY_CHIP = { MISSING: { label: 'Thiếu ATTP', tone: 'danger' }, PENDING: { label: 'ATTP chờ duyệt', tone: 'pending' } } as const;

/** MENU: the storefront's dishes, with a quick in-stock switch. */
export default function MenuScreen() {
  const { colors } = useTheme();
  const { storefront } = useMarketplaceGate();
  const menu = useSellerMenu(storefront?.id);
  const save = useSaveMenuItem(storefront?.id);

  const toggle = (m: SellerItem, on: boolean) =>
    save
      .mutateAsync({ id: m.id, input: { name: m.name, price: m.price, description: m.description, categoryId: m.categoryId, available: on } })
      .catch(showError);

  const full = menu.data ? menu.data.items.length >= menu.data.maxItems : false;

  return (
    <>
      <StackHeader title={storefront ? `Thực đơn · ${storefront.name}` : 'Thực đơn'} />
      <Screen
        onRefresh={menu.refetch}
        refreshing={menu.isRefetching}
        footer={<Button label={full ? 'Đã đủ số món tối đa' : 'Thêm món'} icon="plus" disabled={full || !storefront} onPress={() => goTo('/vendor/store/menu/new')} />}
      >
        <QueryView query={menu}>
          {({ items }) =>
            items.length ? (
              items.map((m) => {
                const attp = m.foodSafety === 'MISSING' || m.foodSafety === 'PENDING' ? FOOD_SAFETY_CHIP[m.foodSafety] : undefined;
                return (
                  <Card key={m.id} onPress={() => goTo(`/vendor/store/menu/${m.id}`)} style={styles.row}>
                    <Thumb size={56} seed={m.id} uri={m.imageUrl} />
                    <View style={styles.body}>
                      <AppText variant="label">{m.name}</AppText>
                      <Money amountVnd={m.price} />
                      <View style={styles.chips}>
                        {!m.available ? <StatusChip code="SOLD_OUT" /> : null}
                        {attp ? <StatusChip label={attp.label} tone={attp.tone} /> : null}
                      </View>
                    </View>
                    <Switch
                      value={m.available}
                      onValueChange={(on) => void toggle(m, on)}
                      trackColor={{ true: colors.primary, false: colors.borderStrong }}
                      accessibilityLabel={`Còn hàng ${m.name}`}
                    />
                  </Card>
                );
              })
            ) : (
              <EmptyState icon="food-off" title="Chưa có món" description="Thêm món để người mua đặt trước." />
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});

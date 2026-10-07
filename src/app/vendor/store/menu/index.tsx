import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState } from '@/components/feedback/States';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { useMockDb } from '@/mocks/db';
import { spacing, useTheme } from '@/theme';

export default function MenuScreen() {
  const { colors } = useTheme();
  const gate = useMarketplaceGate();
  const items = useMockDb((s) => s.menuItems).filter((m) => m.storefrontId === gate.storefront?.id);
  const update = useMockDb((s) => s.updateMenuItem);

  return (
    <>
      <StackHeader title="Thực đơn" />
      <Screen footer={<Button label="Thêm món" icon="plus" onPress={() => goTo('/vendor/store/menu/new')} />}>
        {items.length ? (
          items.map((m) => {
            const available = m.availability_status === 'AVAILABLE';
            return (
              <Card key={m.id} onPress={() => goTo(`/vendor/store/menu/${m.id}`)} style={styles.row}>
                <Thumb size={56} />
                <View style={styles.body}>
                  <AppText variant="label">{m.name}</AppText>
                  <Money amountVnd={m.price} />
                  {!available ? <StatusChip code="SOLD_OUT" /> : null}
                </View>
                <Switch
                  value={available}
                  onValueChange={(on) => update(m.id, { availability_status: on ? 'AVAILABLE' : 'SOLD_OUT' })}
                  trackColor={{ true: colors.primary, false: colors.borderStrong }}
                  accessibilityLabel={`Còn hàng ${m.name}`}
                />
              </Card>
            );
          })
        ) : (
          <EmptyState icon="food-off" title="Chưa có món" />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
});

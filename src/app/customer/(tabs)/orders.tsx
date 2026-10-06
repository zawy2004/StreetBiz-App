import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { StatusChip } from '@/components/status/StatusChip';
import { requireAuth } from '@/core/auth/require-auth';
import { goTo } from '@/core/navigation/go';
import { isActiveOrder } from '@/features/orders/order-utils';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';
import { formatDateTime } from '@/utils/format';

export default function CustomerOrdersScreen() {
  const user = useAuthStore((s) => s.user);
  const orders = useMockDb((s) => s.orders).filter((o) => o.customerId === user?.id);
  const stores = useMockDb((s) => s.storefronts);
  const [tab, setTab] = useState<'active' | 'history'>('active');

  if (!user) {
    return (
      <Screen>
        <EmptyState icon="account-lock-outline" title="Đăng nhập để xem đơn hàng" />
        <Button label="Đăng nhập" onPress={() => requireAuth()} />
      </Screen>
    );
  }

  const list = orders
    .filter((o) => (tab === 'active' ? isActiveOrder(o.order_status) : !isActiveOrder(o.order_status)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <Screen>
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Đang làm' },
          { value: 'history', label: 'Lịch sử' },
        ]}
      />
      {list.length ? (
        list.map((o) => (
          <Card key={o.id} onPress={() => goTo(o.order_status === 'PENDING_PAYMENT' ? `/customer/orders/${o.id}/payment` : `/customer/orders/${o.id}`)} style={styles.row}>
            <View style={styles.body}>
              <AppText variant="label">{stores.find((s) => s.id === o.storefrontId)?.name}</AppText>
              <AppText variant="small" color="muted">
                #{o.order_code} · {o.items.reduce((n, i) => n + i.quantity, 0)} món · {formatDateTime(o.created_at)}
              </AppText>
              <StatusChip code={o.order_status} />
            </View>
            <Money amountVnd={o.total} />
          </Card>
        ))
      ) : (
        <>
          <EmptyState icon="shopping-outline" title="Chưa có đơn" />
          <Button label="Khám phá quán" onPress={() => goTo('/customer/explore')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
});

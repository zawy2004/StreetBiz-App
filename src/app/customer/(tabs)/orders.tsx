import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { Thumb } from '@/components/common/Thumb';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { isActiveOrder } from '@/features/orders/order-utils';
import { useMyOrders } from '@/features/orders/use-orders';
import { spacing } from '@/theme';
import { formatDateTime } from '@/utils/format';

/** ORD-02: the buyer's orders (the customer layout sends guests to sign in before they get here). */
export default function CustomerOrdersScreen() {
  const orders = useMyOrders();
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const all = orders.data ?? [];
  const active = all.filter((o) => isActiveOrder(o.status)).length;
  const list = all.filter((o) => (tab === 'active' ? isActiveOrder(o.status) : !isActiveOrder(o.status)));

  return (
    <Screen onRefresh={orders.refetch} refreshing={orders.isRefetching}>
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: active ? `Đang làm (${active})` : 'Đang làm' },
          { value: 'history', label: 'Lịch sử' },
        ]}
      />
      <QueryView query={orders}>
        {() =>
          list.length ? (
            list.map((o) => (
              <Card
                key={o.id}
                onPress={() => goTo(o.status === 'PENDING_PAYMENT' ? `/customer/orders/${o.id}/payment` : `/customer/orders/${o.id}`)}
                style={styles.row}
              >
                <Thumb size={56} seed={o.storefrontId} icon="storefront-outline" />
                <View style={styles.body}>
                  <AppText variant="label" numberOfLines={1}>{o.storefrontName}</AppText>
                  <AppText variant="small" color="muted" numberOfLines={1}>
                    #{o.code} · {o.items.reduce((n, i) => n + i.quantity, 0)} món · {formatDateTime(o.createdAt)}
                  </AppText>
                  <StatusChip code={o.status} />
                </View>
                <Money amountVnd={o.total} />
              </Card>
            ))
          ) : (
            <EmptyState
              icon="shopping-outline"
              tone="primary"
              title={tab === 'active' ? 'Không có đơn đang làm' : 'Chưa có đơn nào'}
              description="Đặt món trước, tới quầy là lấy, không phải chờ."
            >
              <Button label="Khám phá quán" variant="soft" onPress={() => goTo('/customer/explore')} />
            </EmptyState>
          )
        }
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  body: { flex: 1, gap: spacing.xs, minWidth: 0 },
});

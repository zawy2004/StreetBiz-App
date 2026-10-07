import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState, LoadingState, QueryView } from '@/components/feedback/States';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useVendorOrders } from '@/features/orders/use-orders';
import { GateNotice } from '@/features/storefront/GateNotice';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { spacing } from '@/theme';
import { formatDateTime } from '@/utils/format';

type Tab = 'new' | 'making' | 'ready' | 'done';

const TABS: { value: Tab; label: string; statuses: string[] }[] = [
  { value: 'new', label: 'Mới', statuses: ['PLACED'] },
  { value: 'making', label: 'Đang làm', statuses: ['ACCEPTED', 'PREPARING'] },
  { value: 'ready', label: 'Sẵn sàng', statuses: ['READY_FOR_PICKUP'] },
  { value: 'done', label: 'Xong', statuses: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
];

/** SORD-01: the seller's order board across their storefronts; refreshes every 15 s. */
export default function VendorOrdersScreen() {
  const gate = useMarketplaceGate();
  const orders = useVendorOrders();
  const [tab, setTab] = useState<Tab>('new');

  if (gate.loading) return <Screen><LoadingState /></Screen>;
  if (!gate.open) return <Screen><GateNotice /></Screen>;

  const all = orders.data ?? [];
  const count = (t: Tab) => all.filter((o) => TABS.find((x) => x.value === t)!.statuses.includes(o.status)).length;
  const current = TABS.find((t) => t.value === tab)!;
  const list = all.filter((o) => current.statuses.includes(o.status));
  const multiStore = gate.storefronts.length > 1;

  return (
    <Screen onRefresh={orders.refetch} refreshing={orders.isRefetching}>
      <View style={styles.actions}>
        <View style={styles.half}><Button label="Quét nhận hàng" icon="qrcode-scan" variant="outline" size="sm" onPress={() => goTo('/vendor/store/pickup')} /></View>
        <View style={styles.half}><Button label="Gian hàng" icon="storefront-outline" variant="outline" size="sm" onPress={() => goTo('/vendor/store')} /></View>
      </View>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={TABS.map((t) => {
          const n = t.value === 'done' ? 0 : count(t.value);
          return { value: t.value, label: n ? `${t.label} (${n})` : t.label };
        })}
      />

      <QueryView query={orders}>
        {() =>
          list.length ? (
            list.map((o) => (
              <Card key={o.id} onPress={() => goTo(`/vendor/store/orders/${o.id}`)} style={styles.row}>
                <View style={styles.body}>
                  <AppText variant="label">#{o.code.slice(-8)}{o.customerName ? ` · ${o.customerName}` : ''}</AppText>
                  <AppText variant="small" color="muted">
                    {o.items.reduce((n, i) => n + i.quantity, 0)} món{o.pickupTime ? ` · lấy lúc ${o.pickupTime}` : ` · ${formatDateTime(o.createdAt)}`}
                    {multiStore ? ` · ${o.storefrontName}` : ''}
                  </AppText>
                  <StatusChip code={o.status} />
                </View>
                <Money amountVnd={o.total} />
              </Card>
            ))
          ) : (
            <EmptyState icon="receipt-text-outline" title="Chưa có đơn" />
          )
        }
      </QueryView>

      <Button label="Doanh thu" variant="ghost" icon="chart-line" onPress={() => goTo('/vendor/store/sales')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
});

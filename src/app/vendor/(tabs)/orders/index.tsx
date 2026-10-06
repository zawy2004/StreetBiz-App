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
import { goTo } from '@/core/navigation/go';
import { GateNotice } from '@/features/storefront/GateNotice';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { useMockDb } from '@/mocks/db';
import { spacing } from '@/theme';
import { formatDateTime } from '@/utils/format';

type Tab = 'new' | 'making' | 'ready' | 'done';

const TABS: { value: Tab; label: string; statuses: string[] }[] = [
  { value: 'new', label: 'Mới', statuses: ['PLACED'] },
  { value: 'making', label: 'Đang làm', statuses: ['PREPARING'] },
  { value: 'ready', label: 'Sẵn sàng', statuses: ['READY_FOR_PICKUP'] },
  { value: 'done', label: 'Xong', statuses: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
];

export default function VendorOrdersScreen() {
  const gate = useMarketplaceGate();
  const orders = useMockDb((s) => s.orders).filter((o) => o.storefrontId === gate.storefront?.id);
  const [tab, setTab] = useState<Tab>('new');

  if (!gate.open) {
    return (
      <Screen>
        <GateNotice />
      </Screen>
    );
  }

  const newCount = orders.filter((o) => o.order_status === 'PLACED').length;
  const current = TABS.find((t) => t.value === tab)!;
  const list = orders
    .filter((o) => current.statuses.includes(o.order_status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <Screen>
      <View style={styles.actions}>
        <View style={styles.half}><Button label="Quét nhận hàng" icon="qrcode-scan" variant="outline" size="sm" onPress={() => goTo('/vendor/store/pickup')} /></View>
        <View style={styles.half}><Button label="Gian hàng" icon="storefront-outline" variant="outline" size="sm" onPress={() => goTo('/vendor/store')} /></View>
      </View>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={TABS.map((t) => ({ value: t.value, label: t.value === 'new' && newCount ? `Mới (${newCount})` : t.label }))}
      />

      {list.length ? (
        list.map((o) => (
          <Card key={o.id} onPress={() => goTo(`/vendor/store/orders/${o.id}`)} style={styles.row}>
            <View style={styles.body}>
              <AppText variant="label">#{o.order_code}</AppText>
              <AppText variant="small" color="muted">
                {o.items.reduce((n, i) => n + i.quantity, 0)} món{o.pickup_time ? ` · lấy lúc ${o.pickup_time}` : ` · ${formatDateTime(o.created_at)}`}
              </AppText>
              <StatusChip code={o.order_status} />
            </View>
            <Money amountVnd={o.total} />
          </Card>
        ))
      ) : (
        <EmptyState icon="receipt-text-outline" title="Chưa có đơn" />
      )}

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

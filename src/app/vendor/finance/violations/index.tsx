import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

export default function ViolationsScreen() {
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const penalties = useMockDb((s) => s.penalties).filter((p) => p.vendorId === vendorId);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const list = penalties.filter((p) => (tab === 'open' ? p.penalty_status === 'PENDING' : p.penalty_status !== 'PENDING'));

  return (
    <>
      <StackHeader title="Vi phạm" />
      <Screen>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: 'Chờ xử lý' },
            { value: 'done', label: 'Đã xử lý' },
          ]}
        />
        {list.length ? (
          list.map((p) => (
            <Card key={p.id} onPress={() => goTo(`/vendor/finance/violations/${p.id}`)} style={styles.row}>
              <View style={styles.body}>
                <AppText variant="label" numberOfLines={2}>{p.reason}</AppText>
                <AppText variant="small" color="muted">{formatDate(p.issued_at)}</AppText>
                <StatusChip code={p.penalty_status === 'PENDING' ? 'PENDING_SANCTION' : p.penalty_status} />
              </View>
              <Money amountVnd={p.amount} />
            </Card>
          ))
        ) : (
          <EmptyState icon="shield-check-outline" title="Không có vi phạm" />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
});

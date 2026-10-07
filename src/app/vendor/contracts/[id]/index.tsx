import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Icon, type IconName } from '@/components/common/Icon';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useContract } from '@/features/slots/use-rentals';
import { spacing, useTheme } from '@/theme';
import { formatDate, formatVnd } from '@/utils/format';

/** SIDE-05: a rental contract and what can be done with it. */
export default function ContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contract = useContract(id);

  return (
    <>
      <StackHeader title={contract.data ? `Hợp đồng ${contract.data.slotCode}` : 'Hợp đồng'} />
      <Screen onRefresh={contract.refetch} refreshing={contract.isRefetching}>
        <QueryView query={contract}>
          {(c) => {
            if (!c) return <EmptyState title="Không tìm thấy hợp đồng" />;
            const active = c.status === 'ACTIVE';
            const actions: { label: string; icon: IconName; href: string; highlight?: boolean; hidden?: boolean }[] = [
              { label: 'Giấy phép', icon: 'card-account-details-outline', href: `/vendor/permit/${c.id}`, highlight: true, hidden: !active },
              { label: 'Gia hạn', icon: 'calendar-refresh-outline', href: `/vendor/contracts/${c.id}/renewal`, hidden: !active },
              { label: 'Trả ô', icon: 'logout-variant', href: `/vendor/contracts/${c.id}/return`, hidden: !active },
              { label: 'Chuyển nhượng', icon: 'swap-horizontal', href: `/vendor/contracts/${c.id}/transfer`, hidden: !active },
            ];
            return (
              <>
                <Card style={styles.head}>
                  <View style={styles.headBody}>
                    <AppText variant="title">{c.slotCode}</AppText>
                    <AppText variant="small" color="muted">{c.street}</AppText>
                  </View>
                  <StatusChip code={c.status} />
                </Card>

                <KeyValueCard
                  rows={[
                    { label: 'Kỳ hạn', value: `${formatDate(c.startDate)} - ${formatDate(c.endDate)}` },
                    ...(c.feeMonthly ? [{ label: 'Phí', value: `${formatVnd(c.feeMonthly)}/tháng` }] : []),
                    ...(c.nextDueDate ? [{ label: 'Hạn đóng tiếp', value: formatDate(c.nextDueDate) }] : []),
                  ]}
                />

                <View style={styles.grid}>
                  {actions.filter((a) => !a.hidden).map((a) => (
                    <ActionTile key={a.label} {...a} onPress={() => goTo(a.href)} />
                  ))}
                </View>
              </>
            );
          }}
        </QueryView>
      </Screen>
    </>
  );
}

function ActionTile({ label, icon, highlight, onPress }: { label: string; icon: IconName; highlight?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={[styles.tile, highlight ? { backgroundColor: colors.primarySoft, borderColor: colors.primary } : null]}>
      <Icon name={icon} size={28} color={highlight ? 'primary' : 'indigo'} />
      <AppText variant="label">{label}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headBody: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { width: '47.8%', minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});

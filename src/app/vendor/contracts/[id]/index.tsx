import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { Icon, type IconName } from '@/components/common/Icon';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { spacing, useTheme } from '@/theme';
import { formatDate, formatVnd } from '@/utils/format';

export default function ContractDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contract = useMockDb((s) => s.contracts).find((c) => c.id === id);
  const slot = useMockDb((s) => s.slots).find((s) => s.id === contract?.slotId);
  const permit = useMockDb((s) => s.permits).find((p) => p.contractId === id);
  const nextFee = useMockDb((s) => s.feeItems).find((f) => f.contractId === id && f.item_status !== 'PAID');

  if (!contract) {
    return (
      <>
        <StackHeader title="Hợp đồng" />
        <Screen><EmptyState title="Không tìm thấy hợp đồng" /></Screen>
      </>
    );
  }

  const active = contract.contract_status === 'ACTIVE';
  const actions: { label: string; icon: IconName; href: string; highlight?: boolean; hidden?: boolean }[] = [
    { label: 'Giấy phép', icon: 'card-account-details-outline', href: `/vendor/permit/${permit?.id}`, highlight: true, hidden: !permit },
    { label: 'Gia hạn', icon: 'calendar-refresh-outline', href: `/vendor/contracts/${id}/renewal`, hidden: !active },
    { label: 'Trả ô', icon: 'logout-variant', href: `/vendor/contracts/${id}/return`, hidden: !active },
    { label: 'Chuyển nhượng', icon: 'swap-horizontal', href: `/vendor/contracts/${id}/transfer`, hidden: !active },
  ];

  return (
    <>
      <StackHeader title={`Hợp đồng ${slot?.slot_code ?? ''}`} />
      <Screen>
        <Card style={styles.head}>
          <View style={styles.headBody}>
            <AppText variant="title">{slot?.slot_code}</AppText>
            <AppText variant="small" color="muted">{slot?.street}</AppText>
          </View>
          <StatusChip code={contract.contract_status} />
        </Card>

        <KeyValueCard
          rows={[
            { label: 'Kỳ hạn', value: `${formatDate(contract.start_date)} - ${formatDate(contract.end_date)}` },
            { label: 'Phí', value: `${formatVnd(contract.fee_monthly)}/tháng` },
            ...(nextFee ? [{ label: 'Hạn đóng tiếp', value: formatDate(nextFee.due_date) }] : []),
          ]}
        />

        <View style={styles.grid}>
          {actions.filter((a) => !a.hidden).map((a) => (
            <ActionTile key={a.label} {...a} onPress={() => goTo(a.href)} />
          ))}
        </View>
      </Screen>
    </>
  );
}

function ActionTile({ label, icon, highlight, onPress }: { label: string; icon: IconName; highlight?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={[styles.tile, highlight ? { backgroundColor: colors.errorBg, borderColor: colors.primary } : null]}>
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

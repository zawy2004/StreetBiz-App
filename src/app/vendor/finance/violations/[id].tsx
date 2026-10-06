import { useLocalSearchParams } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { radius, spacing } from '@/theme';
import { formatDateTime, formatVnd } from '@/utils/format';

export default function ViolationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const penalty = useMockDb((s) => s.penalties).find((p) => p.id === id);
  const violation = useMockDb((s) => s.violations).find((v) => v.id === penalty?.violationId) ?? useMockDb.getState().violations.find((v) => v.vendorId === penalty?.vendorId);
  const slot = useMockDb((s) => s.slots).find((s) => s.id === violation?.slotId);

  if (!penalty) {
    return (
      <>
        <StackHeader title="Biên bản" />
        <Screen><EmptyState title="Không tìm thấy biên bản" /></Screen>
      </>
    );
  }

  const open = penalty.penalty_status === 'PENDING';
  const photo = violation?.photoUris[0];

  return (
    <>
      <StackHeader title="Biên bản" />
      <Screen
        footer={open ? <Button label={`Đóng phạt ${formatVnd(penalty.amount)}`} onPress={() => goTo(`/vendor/finance/penalties/${penalty.id}`)} /> : undefined}
      >
        {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
        <Card style={styles.head}>
          <AppText variant="headline">{penalty.reason}</AppText>
          <StatusChip code={open ? 'PENDING_SANCTION' : penalty.penalty_status} />
          <View style={styles.amount}><Money amountVnd={penalty.amount} size="lg" color="error" /></View>
        </Card>
        <KeyValueCard
          rows={[
            { label: 'Ngày lập', value: formatDateTime(penalty.issued_at) },
            ...(slot ? [{ label: 'Ô', value: slot.slot_code }] : []),
            ...(violation?.note ? [{ label: 'Ghi chú', value: violation.note }] : []),
          ]}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  photo: { height: 180, borderRadius: radius.card },
  head: { gap: spacing.sm },
  amount: { marginTop: spacing.xs },
});

import { useLocalSearchParams } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { protectedImage } from '@/core/api/client';
import { goTo } from '@/core/navigation/go';
import { useViolations } from '@/features/finance/use-finance';
import { radius, spacing } from '@/theme';
import { formatDateTime, formatVnd } from '@/utils/format';

/** One violation record and, while unpaid, the way to pay its penalty. */
export default function ViolationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const violations = useViolations();
  const v = violations.data?.find((x) => x.id === id);
  const payable = Boolean(v?.penaltyId && v.amount && (v.status === 'UNPAID' || v.status === 'PENDING_SANCTION'));

  return (
    <>
      <StackHeader title="Biên bản" />
      <Screen footer={payable && v ? <Button label={`Đóng phạt ${formatVnd(v.amount!)}`} onPress={() => goTo(`/vendor/finance/penalties/${v.penaltyId}`)} /> : undefined}>
        <QueryView query={violations}>
          {() =>
            !v ? (
              <EmptyState title="Không tìm thấy biên bản" />
            ) : (
              <>
                {v.photoUrl ? <Image source={protectedImage(v.photoUrl)} style={styles.photo} /> : null}
                <Card style={styles.head}>
                  <AppText variant="headline">{v.reason}</AppText>
                  <StatusChip code={v.status} />
                  {v.amount ? (
                    <View style={styles.amount}>
                      <Money amountVnd={v.amount} size="lg" color="error" />
                    </View>
                  ) : null}
                </Card>
                <KeyValueCard
                  rows={[
                    { label: 'Ngày lập', value: formatDateTime(v.recordedAt) },
                    ...(v.slotCode ? [{ label: 'Ô', value: v.slotCode }] : []),
                    ...(v.note ? [{ label: 'Ghi chú', value: v.note }] : []),
                  ]}
                />
              </>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  photo: { height: 180, borderRadius: radius.card },
  head: { gap: spacing.sm },
  amount: { marginTop: spacing.xs },
});

import dayjs from 'dayjs';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { useContract, useRequestRenewal } from '@/features/slots/use-rentals';
import { radius, spacing, useTheme } from '@/theme';
import { formatDate, formatVnd } from '@/utils/format';

/** SIDE-06: ask the ward to extend the contract. */
export default function RenewalScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contract = useContract(id);
  const request = useRequestRenewal(id ?? '');
  const [months, setMonths] = useState(1);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <>
        <StackHeader title="Gia hạn" />
        <Screen footer={<Button label="Về hợp đồng" onPress={() => router.back()} />}>
          <SuccessView title="Đã gửi yêu cầu" subtitle="Phường sẽ xét duyệt gia hạn" />
        </Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader title="Gia hạn" />
      <Screen
        footer={
          <Button
            label="Gửi yêu cầu"
            loading={request.isPending}
            disabled={!contract.data}
            onPress={() => request.mutateAsync(months).then(() => setDone(true), showError)}
          />
        }
      >
        <QueryView query={contract}>
          {(c) =>
            !c ? (
              <EmptyState title="Không tìm thấy hợp đồng" />
            ) : (
              <>
                <KeyValueCard rows={[{ label: 'Hết hạn hiện tại', value: formatDate(c.endDate) }]} />
                <View style={styles.block}>
                  <AppText variant="labelSm">Gia hạn thêm</AppText>
                  <View style={styles.terms}>
                    {[1, 2, 3].map((m) => {
                      const on = m === months;
                      return (
                        <Pressable
                          key={m}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          onPress={() => setMonths(m)}
                          style={[
                            styles.term,
                            { backgroundColor: on ? colors.primarySoft : colors.card, borderColor: on ? colors.primary : colors.border, borderWidth: on ? 2 : 1 },
                          ]}
                        >
                          <AppText variant="label" color={on ? 'primary' : 'text'}>{m} tháng</AppText>
                          <AppText variant="small" color="muted">{c.feeMonthly ? formatVnd(c.feeMonthly * m) : `${m * 30} ngày`}</AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <Card style={styles.total}>
                  <View>
                    <AppText variant="small" color="muted">Hết hạn mới (dự kiến)</AppText>
                    <AppText variant="label">{formatDate(dayjs(c.endDate).add(months * 30, 'day').toDate())}</AppText>
                  </View>
                </Card>
              </>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  terms: { flexDirection: 'row', gap: spacing.sm },
  term: { flex: 1, minHeight: 64, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', gap: 2 },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

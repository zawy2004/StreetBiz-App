import dayjs from 'dayjs';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { useMockDb } from '@/mocks/db';
import { radius, spacing, useTheme } from '@/theme';
import { formatDate, formatVnd } from '@/utils/format';

export default function RenewalScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const contract = useMockDb((s) => s.contracts).find((c) => c.id === id);
  const request = useMockDb((s) => s.requestRenewal);
  const [months, setMonths] = useState(1);
  const [done, setDone] = useState(false);

  if (!contract) {
    return (
      <>
        <StackHeader title="Gia hạn" />
        <Screen><EmptyState title="Không tìm thấy hợp đồng" /></Screen>
      </>
    );
  }

  const newEnd = dayjs(contract.end_date).add(months, 'month');

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
            onPress={() => {
              request(contract.id, newEnd.toISOString());
              setDone(true);
            }}
          />
        }
      >
        <KeyValueCard rows={[{ label: 'Hết hạn hiện tại', value: formatDate(contract.end_date) }]} />

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
                    { backgroundColor: on ? colors.errorBg : colors.card, borderColor: on ? colors.primary : colors.border, borderWidth: on ? 2 : 1 },
                  ]}
                >
                  <AppText variant="label" color={on ? 'primary' : 'text'}>{m} tháng</AppText>
                  <AppText variant="small" color="muted">{formatVnd(contract.fee_monthly * m)}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card style={styles.total}>
          <View>
            <AppText variant="small" color="muted">Hết hạn mới</AppText>
            <AppText variant="label">{formatDate(newEnd.toDate())}</AppText>
          </View>
          <Money amountVnd={contract.fee_monthly * months} size="lg" color="primary" />
        </Card>
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

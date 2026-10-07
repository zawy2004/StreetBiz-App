import dayjs from 'dayjs';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { CheckRow } from '@/components/forms/Choices';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goReplace } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { radius, spacing, useTheme } from '@/theme';
import { formatVnd, parseDate } from '@/utils/format';

const TERMS = [1, 2, 3];

export default function ApplySlotScreen() {
  const { colors } = useTheme();
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const slot = useMockDb((s) => s.slots).find((s) => s.id === slotId);
  const submit = useMockDb((s) => s.submitRentalApplication);
  const vendorId = useAuthStore((s) => s.user?.vendorId);

  const [months, setMonths] = useState(1);
  const [start, setStart] = useState(dayjs().add(1, 'day').format('DD/MM/YYYY'));
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string>();

  if (!slot || !vendorId) {
    return (
      <>
        <StackHeader title="Nộp đơn thuê" />
        <Screen><EmptyState title="Không tìm thấy ô" /></Screen>
      </>
    );
  }

  function send() {
    const date = parseDate(start);
    if (!date) return setError('Nhập ngày theo dạng 07/10/2026');
    if (date.isBefore(dayjs().startOf('day'))) return setError('Ngày bắt đầu phải từ hôm nay');
    const application = submit({ vendorId: vendorId!, slotIds: [slot!.id], application_type: 'OPEN_SLOT' });
    goReplace(`/vendor/applications/${application.id}`);
  }

  return (
    <>
      <StackHeader title="Nộp đơn thuê" />
      <Screen footer={<Button label="Gửi đơn" disabled={!agreed} onPress={send} />}>
        <Card style={styles.slot}>
          <View style={styles.slotBody}>
            <AppText variant="headline">{slot.slot_code}</AppText>
            <AppText variant="small" color="muted">{slot.street} · {slot.size_m2} m²</AppText>
          </View>
          <StatusChip code={slot.slot_status} />
        </Card>

        <View style={styles.block}>
          <AppText variant="labelSm">Thời hạn thuê</AppText>
          <View style={styles.terms}>
            {TERMS.map((m) => {
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
                  <AppText variant="small" color="muted">{formatVnd(slot.price_monthly * m)}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextField
          label="Ngày bắt đầu"
          icon="calendar-outline"
          value={start}
          onChangeText={(v) => {
            setStart(v);
            setError(undefined);
          }}
          keyboardType="numbers-and-punctuation"
          error={error}
        />

        <Card style={[styles.total, { backgroundColor: colors.sunken }]}>
          <AppText color="muted">Tổng phí</AppText>
          <Money amountVnd={slot.price_monthly * months} size="lg" color="primary" />
        </Card>

        <CheckRow label="Tôi cam kết giữ lối đi bộ tối thiểu 1,5 m" checked={agreed} onToggle={() => setAgreed((a) => !a)} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  slot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  slotBody: { flex: 1 },
  block: { gap: spacing.sm },
  terms: { flexDirection: 'row', gap: spacing.sm },
  term: { flex: 1, minHeight: 64, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', gap: 2 },
  total: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

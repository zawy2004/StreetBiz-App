import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError } from '@/components/feedback/Toast';
import { CheckRow } from '@/components/forms/Choices';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goReplace } from '@/core/navigation/go';
import { useApplyForSlot, useSlot, useSlotQuote } from '@/features/slots/use-rentals';
import { radius, spacing, useTheme } from '@/theme';
import { formatVnd } from '@/utils/format';

const TERMS = [1, 2, 3];

/** SIDE-03A: apply for an open slot; the ward reviews it and issues the contract and permit. */
export default function ApplySlotScreen() {
  const { colors } = useTheme();
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const slot = useSlot(slotId);
  const apply = useApplyForSlot();
  const [months, setMonths] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const quote = useSlotQuote(slotId, months);

  async function send() {
    if (!slotId) return;
    try {
      const id = await apply.mutateAsync({ slotId, months });
      goReplace(`/vendor/applications/${id}`);
    } catch (e) {
      showError(e);
    }
  }

  return (
    <>
      <StackHeader title="Nộp đơn thuê" />
      <Screen footer={<Button label="Gửi đơn" disabled={!agreed || !slot.data} loading={apply.isPending} onPress={() => void send()} />}>
        <QueryView query={slot}>
          {(s) =>
            !s ? (
              <EmptyState title="Không tìm thấy ô" />
            ) : (
              <>
                <Card style={styles.slot}>
                  <View style={styles.slotBody}>
                    <AppText variant="headline">{s.code}</AppText>
                    <AppText variant="small" color="muted">{s.street} · {s.sizeLabel}</AppText>
                  </View>
                  <StatusChip code={s.status} />
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
                            { backgroundColor: on ? colors.primarySoft : colors.card, borderColor: on ? colors.primary : colors.border, borderWidth: on ? 2 : 1 },
                          ]}
                        >
                          <AppText variant="label" color={on ? 'primary' : 'text'}>{m} tháng</AppText>
                          <AppText variant="small" color="muted">{m * 30} ngày</AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <Card style={[styles.total, { backgroundColor: colors.sunken }]}>
                  <View>
                    <AppText color="muted">Tạm tính</AppText>
                    <AppText variant="caption" color="muted">Phường chốt phí khi duyệt</AppText>
                  </View>
                  {quote.data !== undefined ? <Money amountVnd={quote.data} size="lg" color="primary" /> : <AppText color="muted">{formatVnd(s.priceMonthly * months)}</AppText>}
                </Card>

                <CheckRow label="Tôi cam kết giữ lối đi bộ tối thiểu 1,5 m và bán đúng ô, đúng giờ" checked={agreed} onToggle={() => setAgreed((a) => !a)} />
              </>
            )
          }
        </QueryView>
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

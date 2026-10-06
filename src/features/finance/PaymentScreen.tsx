import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { RadioRow } from '@/components/forms/Choices';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goReplace } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { spacing } from '@/theme';
import { formatVnd } from '@/utils/format';

import { transactionCode } from './utils';

const METHODS = [
  { value: 'MOMO', label: 'MoMo' },
  { value: 'ZALOPAY', label: 'ZaloPay' },
  { value: 'CARD', label: 'Thẻ ngân hàng' },
];

/** Sandbox payment: picking a method and confirming marks the item paid immediately. */
export function PaymentScreen({ kind }: { kind: 'fee' | 'penalty' }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fee = useMockDb((s) => s.feeItems).find((f) => f.id === id);
  const penalty = useMockDb((s) => s.penalties).find((p) => p.id === id);
  const slots = useMockDb((s) => s.slots);
  const contracts = useMockDb((s) => s.contracts);
  const payFee = useMockDb((s) => s.payFee);
  const payPenalty = useMockDb((s) => s.payPenalty);
  const [method, setMethod] = useState('MOMO');

  const item = kind === 'fee' ? fee : penalty;
  if (!item) {
    return (
      <>
        <StackHeader title="Thanh toán" />
        <Screen><EmptyState title="Không tìm thấy khoản thanh toán" /></Screen>
      </>
    );
  }

  const amount = item.amount;
  const title = fee && kind === 'fee' ? `Phí thuê ô ${fee.period_label}` : penalty?.reason ?? '';
  const slotCode =
    fee && kind === 'fee' ? slots.find((s) => s.id === contracts.find((c) => c.id === fee.contractId)?.slotId)?.slot_code : undefined;

  function pay() {
    if (kind === 'fee') payFee(item!.id);
    else payPenalty(item!.id);
    const q = new URLSearchParams({ amount: String(amount), label: title, code: transactionCode() });
    goReplace(`/vendor/finance/success?${q.toString()}`);
  }

  return (
    <>
      <StackHeader title="Thanh toán" />
      <Screen footer={<Button label={`Thanh toán ${formatVnd(amount)}`} onPress={pay} />}>
        <Card style={styles.summary}>
          <AppText variant="label">{title}</AppText>
          {slotCode ? <AppText variant="small" color="muted">{slotCode}</AppText> : null}
          <Money amountVnd={amount} size="lg" color="primary" />
        </Card>
        <View style={styles.methods}>
          <AppText variant="labelSm">Phương thức</AppText>
          {METHODS.map((m) => (
            <RadioRow key={m.value} label={m.label} selected={m.value === method} onPress={() => setMethod(m.value)} />
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.xs },
  methods: { gap: spacing.sm },
});

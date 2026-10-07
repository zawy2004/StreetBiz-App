import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { showError } from '@/components/feedback/Toast';
import { CheckRow, RadioRow } from '@/components/forms/Choices';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { useComplain, useMyOrder } from '@/features/orders/use-orders';
import { spacing } from '@/theme';
import { formatVnd } from '@/utils/format';

const REASONS = ['Món không đúng', 'Chất lượng kém', 'Không nhận được hàng', 'Khác'];

/** ORD-05: complain about an order, optionally asking for a refund. Reviewed by the platform. */
export default function OrderComplaintScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useMyOrder(id).data;
  const complain = useComplain(id ?? '');
  const [reason, setReason] = useState<string>();
  const [detail, setDetail] = useState('');
  const [refund, setRefund] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  async function send() {
    if (!reason) return setError('Chọn lý do');
    try {
      await complain.mutateAsync({ refund, description: [reason, detail.trim()].filter(Boolean).join(': '), refundAmount: order?.total });
      setDone(true);
    } catch (e) {
      showError(e);
    }
  }

  if (done) {
    return (
      <>
        <StackHeader title="Khiếu nại" />
        <Screen footer={<Button label="Xong" onPress={() => router.back()} />}>
          <SuccessView title="Đã gửi khiếu nại" subtitle="Bộ phận hỗ trợ sẽ phản hồi sớm" />
        </Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader title="Khiếu nại" />
      <Screen footer={<Button label="Gửi khiếu nại" loading={complain.isPending} onPress={() => void send()} />}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="labelSm">Lý do</AppText>
          {REASONS.map((r) => (
            <RadioRow key={r} label={r} selected={r === reason} onPress={() => { setReason(r); setError(undefined); }} />
          ))}
          {error ? <AppText variant="small" color="error">{error}</AppText> : null}
        </View>
        <TextField label="Mô tả" multiline placeholder="Không bắt buộc" value={detail} onChangeText={setDetail} />
        <CheckRow
          label={order ? `Yêu cầu hoàn tiền (${formatVnd(order.total)})` : 'Yêu cầu hoàn tiền'}
          checked={refund}
          onToggle={() => setRefund((r) => !r)}
        />
      </Screen>
    </>
  );
}

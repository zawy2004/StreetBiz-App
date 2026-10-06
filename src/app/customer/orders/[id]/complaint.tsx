import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { CheckRow, RadioRow } from '@/components/forms/Choices';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';

const REASONS = ['Món không đúng', 'Chất lượng kém', 'Không nhận được hàng', 'Khác'];

export default function OrderComplaintScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const addComplaint = useMockDb((s) => s.addComplaint);
  const [reason, setReason] = useState<string>();
  const [detail, setDetail] = useState('');
  const [photo, setPhoto] = useState<string>();
  const [refund, setRefund] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  function send() {
    if (!reason) return setError('Chọn lý do');
    if (!user || !id) return;
    addComplaint({
      orderId: id,
      customerId: user.id,
      complaint_type: refund ? 'REFUND_REQUEST' : 'COMPLAINT',
      description: [reason, detail.trim()].filter(Boolean).join(': '),
    });
    setDone(true);
  }

  if (done) {
    return (
      <>
        <StackHeader title="Khiếu nại" />
        <Screen footer={<Button label="Xong" onPress={() => router.back()} />}>
          <SuccessView title="Đã gửi khiếu nại" subtitle="Chúng tôi sẽ phản hồi sớm" />
        </Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader title="Khiếu nại" />
      <Screen footer={<Button label="Gửi khiếu nại" onPress={send} />}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="labelSm">Lý do</AppText>
          {REASONS.map((r) => (
            <RadioRow key={r} label={r} selected={r === reason} onPress={() => { setReason(r); setError(undefined); }} />
          ))}
          {error ? <AppText variant="small" color="error">{error}</AppText> : null}
        </View>
        <TextField label="Mô tả" multiline placeholder="Không bắt buộc" value={detail} onChangeText={setDetail} />
        <View style={{ gap: spacing.sm }}>
          <AppText variant="labelSm">Ảnh</AppText>
          <PhotoSlot uri={photo} onChange={setPhoto} />
        </View>
        <CheckRow label="Yêu cầu hoàn tiền" checked={refund} onToggle={() => setRefund((r) => !r)} />
      </Screen>
    </>
  );
}

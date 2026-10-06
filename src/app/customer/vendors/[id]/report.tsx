import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { RadioRow } from '@/components/forms/Choices';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { requireAuth } from '@/core/auth/require-auth';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';

const REASONS = ['Lấn chiếm lối đi', 'Bán ngoài ô được cấp', 'Hàng kém chất lượng', 'Khác'];

export default function VendorReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const addReport = useMockDb((s) => s.addReport);
  const [reason, setReason] = useState<string>();
  const [detail, setDetail] = useState('');
  const [photo, setPhoto] = useState<string>();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  function send() {
    if (!requireAuth() || !user) return;
    if (!reason) return setError('Chọn lý do');
    addReport({
      vendorId: id,
      reporterId: user.id,
      reason: detail.trim() ? `${reason}: ${detail.trim()}` : reason,
      photoUri: photo,
    });
    setDone(true);
  }

  if (done) {
    return (
      <>
        <StackHeader title="Báo cáo" />
        <Screen footer={<Button label="Xong" onPress={() => router.back()} />}>
          <SuccessView title="Đã gửi báo cáo" subtitle="Cảm ơn bạn đã giúp giữ vỉa hè trật tự" />
        </Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader title="Báo cáo hộ kinh doanh" />
      <Screen footer={<Button label="Gửi báo cáo" onPress={send} />}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="labelSm">Lý do</AppText>
          {REASONS.map((r) => (
            <RadioRow key={r} label={r} selected={r === reason} onPress={() => { setReason(r); setError(undefined); }} />
          ))}
          {error ? <AppText variant="small" color="error">{error}</AppText> : null}
        </View>
        <TextField label="Mô tả" placeholder="Không bắt buộc" multiline value={detail} onChangeText={setDetail} />
        <View style={{ gap: spacing.sm }}>
          <AppText variant="labelSm">Ảnh</AppText>
          <PhotoSlot uri={photo} onChange={setPhoto} />
        </View>
      </Screen>
    </>
  );
}

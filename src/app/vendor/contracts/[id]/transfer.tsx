import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { EmptyState } from '@/components/feedback/States';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { phoneDigits } from '@/utils/format';

export default function TransferInitiateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contract = useMockDb((s) => s.contracts).find((c) => c.id === id);
  const slot = useMockDb((s) => s.slots).find((s) => s.id === contract?.slotId);
  const users = useMockDb((s) => s.users);
  const initiate = useMockDb((s) => s.initiateTransfer);
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  if (!contract || !vendorId) {
    return (
      <>
        <StackHeader title="Chuyển nhượng" />
        <Screen><EmptyState title="Không tìm thấy hợp đồng" /></Screen>
      </>
    );
  }

  const receiver = users.find(
    (u) => u.role_code === 'VENDOR' && u.vendorId !== vendorId && phoneDigits(u.phone) === phoneDigits(phone),
  );

  if (done) {
    return (
      <>
        <StackHeader title="Chuyển nhượng" />
        <Screen footer={<Button label="Về hợp đồng" onPress={() => router.back()} />}>
          <SuccessView title="Đã gửi yêu cầu" subtitle="Chờ bên nhận đồng ý" />
        </Screen>
      </>
    );
  }

  function send() {
    if (!receiver) return setError('Không tìm thấy hộ kinh doanh với số này');
    initiate(contract!.id, vendorId!, phone);
    setDone(true);
  }

  return (
    <>
      <StackHeader title="Chuyển nhượng" />
      <Screen footer={<Button label="Gửi yêu cầu" onPress={send} />}>
        <KeyValueCard rows={[{ label: 'Ô', value: slot?.slot_code ?? '' }]} />
        <TextField
          label="Số điện thoại bên nhận"
          icon="phone-outline"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            setError(undefined);
          }}
          error={error}
        />
        {receiver ? <KeyValueCard rows={[{ label: 'Bên nhận', value: receiver.fullName }]} /> : null}
      </Screen>
    </>
  );
}

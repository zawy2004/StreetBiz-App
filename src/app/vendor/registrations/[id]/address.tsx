import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { EmptyState } from '@/components/feedback/States';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { useMockDb } from '@/mocks/db';

export default function AddressChangeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const registration = useMockDb((s) => s.registrations).find((r) => r.id === id);
  const request = useMockDb((s) => s.requestAddressChange);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  if (!registration) {
    return (
      <>
        <StackHeader title="Đổi địa chỉ" />
        <Screen><EmptyState title="Không tìm thấy hồ sơ" /></Screen>
      </>
    );
  }

  if (done) {
    return (
      <>
        <StackHeader title="Đổi địa chỉ" />
        <Screen footer={<Button label="Về hồ sơ" onPress={() => router.back()} />}>
          <SuccessView title="Đã gửi yêu cầu" subtitle="Phường sẽ xem xét địa chỉ mới" />
        </Screen>
      </>
    );
  }

  function send() {
    if (!address.trim()) return setError('Nhập địa chỉ mới');
    request({ vendorId: registration!.vendorId, registrationId: registration!.id, new_address: address.trim() });
    setDone(true);
  }

  return (
    <>
      <StackHeader title="Đổi địa chỉ" />
      <Screen footer={<Button label="Gửi yêu cầu" onPress={send} />}>
        <KeyValueCard rows={[{ label: 'Địa chỉ hiện tại', value: registration.address }]} />
        <TextField label="Địa chỉ mới" icon="map-marker-outline" value={address} onChangeText={(v) => { setAddress(v); setError(undefined); }} error={error} />
        <AppText variant="small" color="onSecondary">Ô liền kề hiện tại sẽ được xem xét lại.</AppText>
      </Screen>
    </>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { SuccessView } from '@/components/layout/SuccessView';
import { errorMessage } from '@/core/api/problem';
import { useRegistration, useRequestAddressChange } from '@/features/registration/use-registrations';

/** SIDE-09: move the business to a new address; the ward reviews the adjacent slot. */
export default function AddressChangeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const registration = useRegistration(id);
  const request = useRequestAddressChange(id ?? '');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

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

  async function send() {
    if (!address.trim()) return setError('Nhập địa chỉ mới');
    try {
      await request.mutateAsync(address.trim());
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <StackHeader title="Đổi địa chỉ" />
      <Screen footer={<Button label="Gửi yêu cầu" loading={request.isPending} onPress={() => void send()} />}>
        <QueryView query={registration}>
          {(r) =>
            !r ? (
              <EmptyState title="Không tìm thấy hồ sơ" />
            ) : (
              <>
                <KeyValueCard rows={[{ label: 'Địa chỉ hiện tại', value: r.address || '—' }]} />
                <TextField label="Địa chỉ mới" icon="map-marker-outline" value={address} onChangeText={(v) => { setAddress(v); setError(undefined); }} error={error} />
                <AppText variant="small" color="onSecondary">Ô liền kề hiện tại sẽ được xem xét lại.</AppText>
              </>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

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
import { useContract, useRequestTransfer } from '@/features/slots/use-rentals';
import { phoneDigits } from '@/utils/format';

/** SIDE-12: offer the slot to another vendor; they accept, then the ward reviews. */
export default function TransferInitiateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contract = useContract(id);
  const transfer = useRequestTransfer(id ?? '');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  async function send() {
    if (phoneDigits(phone).length !== 10) return setError('Số điện thoại gồm 10 số');
    try {
      await transfer.mutateAsync(phone);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (done) {
    return (
      <>
        <StackHeader title="Chuyển nhượng" />
        <Screen footer={<Button label="Về hợp đồng" onPress={() => router.back()} />}>
          <SuccessView title="Đã gửi yêu cầu" subtitle="Chờ bên nhận đồng ý, sau đó phường xét duyệt" />
        </Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader title="Chuyển nhượng" />
      <Screen footer={<Button label="Gửi yêu cầu" loading={transfer.isPending} onPress={() => void send()} />}>
        <QueryView query={contract}>
          {(c) =>
            !c ? (
              <EmptyState title="Không tìm thấy hợp đồng" />
            ) : (
              <>
                <KeyValueCard rows={[{ label: 'Ô', value: `${c.slotCode} · ${c.street}` }]} />
                <TextField
                  label="Số điện thoại hộ kinh doanh nhận"
                  icon="phone-outline"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v);
                    setError(undefined);
                  }}
                  error={error}
                />
                <AppText variant="caption" color="muted">Bên nhận phải có tài khoản hộ kinh doanh trên StreetBiz.</AppText>
              </>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

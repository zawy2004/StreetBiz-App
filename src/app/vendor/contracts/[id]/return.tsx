import { useLocalSearchParams } from 'expo-router';
import { goRoot } from '@/core/navigation/go';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/States';
import { SelectField } from '@/components/forms/SelectField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useMockDb } from '@/mocks/db';
import { formatDate } from '@/utils/format';

const REASONS = [
  { value: 'stop', label: 'Ngừng kinh doanh' },
  { value: 'move', label: 'Chuyển địa điểm' },
  { value: 'cost', label: 'Chi phí cao' },
  { value: 'other', label: 'Lý do khác' },
];

export default function ReturnSlotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contract = useMockDb((s) => s.contracts).find((c) => c.id === id);
  const slot = useMockDb((s) => s.slots).find((s) => s.id === contract?.slotId);
  const returnSlot = useMockDb((s) => s.returnSlot);
  const [reason, setReason] = useState<string>();
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();

  if (!contract) {
    return (
      <>
        <StackHeader title="Trả ô" />
        <Screen><EmptyState title="Không tìm thấy hợp đồng" /></Screen>
      </>
    );
  }

  return (
    <>
      <StackHeader title="Trả ô" />
      <Screen
        footer={
          <Button
            label="Trả ô"
            variant="danger"
            onPress={() => (reason ? setConfirm(true) : setError('Chọn lý do trả ô'))}
          />
        }
      >
        <KeyValueCard
          rows={[
            { label: 'Ô', value: slot?.slot_code ?? '' },
            { label: 'Hết hạn', value: formatDate(contract.end_date) },
          ]}
        />
        <SelectField
          label="Lý do"
          value={reason}
          options={REASONS}
          onChange={(v) => {
            setReason(v);
            setError(undefined);
          }}
          error={error}
        />
        <TextField label="Ghi chú" placeholder="Không bắt buộc" multiline value={note} onChangeText={setNote} />
        <AppText variant="small" color="error">Phí đã đóng không được hoàn lại.</AppText>
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Trả ô này?"
        description="Giấy phép sẽ hết hiệu lực ngay."
        confirmLabel="Trả ô"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          returnSlot(contract.id);
          setConfirm(false);
          goRoot('/vendor/slots');
        }}
      />
    </>
  );
}

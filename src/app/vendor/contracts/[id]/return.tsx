import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { SelectField } from '@/components/forms/SelectField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { goRoot } from '@/core/navigation/go';
import { useContract, useReturnSlot } from '@/features/slots/use-rentals';
import { formatDate } from '@/utils/format';

const REASONS = [
  { value: 'Ngừng kinh doanh', label: 'Ngừng kinh doanh' },
  { value: 'Chuyển địa điểm', label: 'Chuyển địa điểm' },
  { value: 'Chi phí cao', label: 'Chi phí cao' },
  { value: 'Lý do khác', label: 'Lý do khác' },
];

/** SIDE-07: hand the slot back before the contract ends. */
export default function ReturnSlotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const contract = useContract(id);
  const returnSlot = useReturnSlot(id ?? '');
  const [reason, setReason] = useState<string>();
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <>
      <StackHeader title="Trả ô" />
      <Screen
        footer={<Button label="Trả ô" variant="danger" loading={returnSlot.isPending} onPress={() => (reason ? setConfirm(true) : setError('Chọn lý do trả ô'))} />}
      >
        <QueryView query={contract}>
          {(c) =>
            !c ? (
              <EmptyState title="Không tìm thấy hợp đồng" />
            ) : (
              <>
                <KeyValueCard rows={[{ label: 'Ô', value: c.slotCode }, { label: 'Hết hạn', value: formatDate(c.endDate) }]} />
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
              </>
            )
          }
        </QueryView>
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Trả ô này?"
        description="Giấy phép sẽ hết hiệu lực ngay."
        confirmLabel="Trả ô"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          returnSlot.mutateAsync([reason, note.trim()].filter(Boolean).join(': ') || null).then(() => {
            showToast('Đã trả ô');
            goRoot('/vendor/slots');
          }, showError);
        }}
      />
    </>
  );
}

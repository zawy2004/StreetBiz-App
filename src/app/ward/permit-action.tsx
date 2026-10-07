import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goRoot } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';

export default function PermitActionScreen() {
  const { permitId } = useLocalSearchParams<{ permitId: string }>();
  const permit = useMockDb((s) => s.permits).find((p) => p.id === permitId);
  const suspend = useMockDb((s) => s.suspendPermit);
  const revoke = useMockDb((s) => s.revokePermit);
  const [action, setAction] = useState<'suspend' | 'revoke'>('suspend');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);

  const isSuspend = action === 'suspend';

  function apply() {
    if (!permit) return;
    (isSuspend ? suspend : revoke)(permit.id);
    setConfirm(false);
    goRoot('/ward/patrol');
  }

  return (
    <>
      <StackHeader title="Xử lý giấy phép" />
      <Screen
        footer={
          <Button
            label={isSuspend ? 'Tạm ngưng giấy phép' : 'Thu hồi giấy phép'}
            variant="danger"
            onPress={() => (reason.trim() ? setConfirm(true) : setError('Nhập lý do'))}
          />
        }
      >
        <KeyValueCard
          rows={[
            { label: 'Giấy phép', value: permit?.permit_code ?? '' },
            { label: 'Trạng thái', node: <StatusChip code={permit?.permit_status ?? 'NOT_FOUND'} /> },
          ]}
        />
        <SegmentedControl
          value={action}
          onChange={setAction}
          options={[
            { value: 'suspend', label: 'Tạm ngưng' },
            { value: 'revoke', label: 'Thu hồi' },
          ]}
        />
        <TextField
          label="Lý do (bắt buộc)"
          multiline
          value={reason}
          onChangeText={(v) => {
            setReason(v);
            setError(undefined);
          }}
          error={error}
        />
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title={isSuspend ? 'Tạm ngưng giấy phép?' : 'Thu hồi giấy phép?'}
        description={isSuspend ? 'Hộ này sẽ không được bán cho đến khi mở lại.' : 'Giấy phép sẽ mất hiệu lực vĩnh viễn.'}
        confirmLabel={isSuspend ? 'Tạm ngưng' : 'Thu hồi'}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={apply}
      />
    </>
  );
}

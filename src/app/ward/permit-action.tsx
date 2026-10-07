import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { showError, showToast } from '@/components/feedback/Toast';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goRoot } from '@/core/navigation/go';
import { usePermitAction } from '@/features/violation/use-patrol';

/** WARD-12/13: suspend or revoke the permit that was just inspected. */
export default function PermitActionScreen() {
  const { permitId, name, slot, status } = useLocalSearchParams<{ permitId: string; name?: string; slot?: string; status?: string }>();
  const act = usePermitAction();
  const [action, setAction] = useState<'suspend' | 'revoke'>('suspend');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);

  const isSuspend = action === 'suspend';

  function apply() {
    setConfirm(false);
    if (!permitId) return;
    act.mutateAsync({ permitId, action, reason: reason.trim() }).then(() => {
      showToast(isSuspend ? 'Đã tạm ngưng giấy phép' : 'Đã thu hồi giấy phép');
      goRoot('/ward/patrol');
    }, showError);
  }

  return (
    <>
      <StackHeader title="Xử lý giấy phép" />
      <Screen
        footer={
          <Button
            label={isSuspend ? 'Tạm ngưng giấy phép' : 'Thu hồi giấy phép'}
            variant="danger"
            loading={act.isPending}
            onPress={() => (reason.trim() ? setConfirm(true) : setError('Nhập lý do'))}
          />
        }
      >
        <KeyValueCard
          rows={[
            ...(name ? [{ label: 'Hộ kinh doanh', value: name }] : []),
            ...(slot ? [{ label: 'Ô', value: slot }] : []),
            { label: 'Trạng thái', node: <StatusChip code={status ?? 'VALID'} /> },
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

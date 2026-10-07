import { useLocalSearchParams } from 'expo-router';
import { goReplace } from '@/core/navigation/go';
import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { useMockDb } from '@/mocks/db';
import { formatDateTime } from '@/utils/format';

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const application = useMockDb((s) => s.applications).find((a) => a.id === id);
  const slots = useMockDb((s) => s.slots);
  const cancel = useMockDb((s) => s.cancelRentalApplication);
  const [confirm, setConfirm] = useState(false);

  if (!application) {
    return (
      <>
        <StackHeader title="Đơn thuê" />
        <Screen><EmptyState title="Không tìm thấy đơn" /></Screen>
      </>
    );
  }

  const codes = application.slotIds.map((s) => slots.find((x) => x.id === s)?.slot_code).join(', ');
  const pending = application.application_status === 'PENDING';

  return (
    <>
      <StackHeader title="Đơn thuê" />
      <Screen
        footer={
          pending ? <Button label="Huỷ đơn" variant="danger" onPress={() => setConfirm(true)} /> : (
            <Button label="Về Ô thuê" variant="outline" onPress={() => goReplace('/vendor/slots')} />
          )
        }
      >
        <StatusChip code={application.application_status} />
        <KeyValueCard
          rows={[
            { label: 'Ô', value: codes },
            { label: 'Loại đơn', value: application.application_type === 'OPEN_SLOT' ? 'Ô trống' : 'Liền kề địa chỉ' },
            { label: 'Đã nộp', value: formatDateTime(application.submitted_at) },
          ]}
        />
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Huỷ đơn thuê?"
        description="Ô sẽ được trả về trạng thái còn trống."
        confirmLabel="Huỷ đơn"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          cancel(application.id);
          setConfirm(false);
        }}
      />
    </>
  );
}

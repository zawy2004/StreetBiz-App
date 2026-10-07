import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goReplace } from '@/core/navigation/go';
import { useApplication, useWithdrawApplication } from '@/features/slots/use-rentals';
import { useTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

const OPEN = ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'];

/** SIDE-04: one rental application and its review outcome. */
export default function ApplicationDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const application = useApplication(id);
  const withdraw = useWithdrawApplication();
  const [confirm, setConfirm] = useState(false);
  const a = application.data;
  const pending = a ? OPEN.includes(a.status) : false;

  return (
    <>
      <StackHeader title="Đơn thuê" />
      <Screen
        onRefresh={application.refetch}
        refreshing={application.isRefetching}
        footer={
          a ? (
            pending ? (
              <Button label="Rút đơn" variant="danger" loading={withdraw.isPending} onPress={() => setConfirm(true)} />
            ) : (
              <Button label="Về Ô thuê" variant="outline" onPress={() => goReplace('/vendor/slots')} />
            )
          ) : undefined
        }
      >
        <QueryView query={application}>
          {(v) =>
            !v ? (
              <EmptyState title="Không tìm thấy đơn" />
            ) : (
              <>
                <StatusChip code={v.status} />
                <KeyValueCard
                  rows={[
                    { label: 'Ô', value: v.slotLabel },
                    { label: 'Loại đơn', value: v.typeLabel },
                    ...(v.termDays ? [{ label: 'Thời hạn', value: `${v.termDays} ngày` }] : []),
                    { label: 'Đã nộp', value: formatDateTime(v.submittedAt) },
                  ]}
                />
                {v.reviewNote ? (
                  <Card style={{ backgroundColor: colors.secondaryBg, borderColor: colors.secondaryBg }}>
                    <AppText variant="small" color="onSecondary">Phường: {v.reviewNote}</AppText>
                  </Card>
                ) : null}
              </>
            )
          }
        </QueryView>
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Rút đơn thuê?"
        description="Ô sẽ được trả về trạng thái còn trống."
        confirmLabel="Rút đơn"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          if (a) withdraw.mutateAsync(a.id).then(() => showToast('Đã rút đơn'), showError);
        }}
      />
    </>
  );
}

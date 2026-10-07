import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { showError, showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goRoot, goTo } from '@/core/navigation/go';
import { useRegistration, useWithdrawRegistration } from '@/features/registration/use-registrations';
import { spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

const TYPE_LABEL = { FIXED_STOREFRONT: 'Cửa hàng cố định', ITINERANT: 'Bán hàng lưu động' } as const;

/** REG-03 detail: where the registration stands and what the ward asked for. */
export default function RegistrationDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const registration = useRegistration(id);
  const withdraw = useWithdrawRegistration();
  const [confirm, setConfirm] = useState(false);
  const r = registration.data;

  const status = r?.status ?? '';
  const needMore = status === 'MORE_INFORMATION_REQUIRED';
  const closed = ['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(status);

  return (
    <>
      <StackHeader title="Hồ sơ" />
      <Screen
        onRefresh={registration.refetch}
        refreshing={registration.isRefetching}
        footer={
          r ? (
            needMore ? (
              <Button label="Bổ sung giấy tờ" onPress={() => goTo(`/vendor/registrations/${r.id}/evidence`)} />
            ) : status === 'APPROVED' ? (
              <Button label="Đổi địa chỉ" variant="outline" onPress={() => goTo(`/vendor/registrations/${r.id}/address`)} />
            ) : !closed ? (
              <Button label="Rút hồ sơ" variant="danger" loading={withdraw.isPending} onPress={() => setConfirm(true)} />
            ) : undefined
          ) : undefined
        }
      >
        <QueryView query={registration}>
          {(v) => {
            if (!v) return <EmptyState title="Không tìm thấy hồ sơ" />;
            const steps = [
              { label: 'Đã nộp', at: formatDate(v.submittedAt), done: true },
              { label: 'Đang xét', done: !['SUBMITTED', 'PENDING', 'DRAFT'].includes(v.status) },
              {
                label: needMore ? 'Cần bổ sung' : v.status === 'REJECTED' ? 'Bị từ chối' : v.status === 'WITHDRAWN' ? 'Đã rút' : 'Đã duyệt',
                done: closed,
                current: needMore,
              },
            ];
            return (
              <>
                <Card style={styles.head}>
                  <AppText variant="title">{v.name}</AppText>
                  <AppText variant="small" color="muted">{TYPE_LABEL[v.vendorType]}{v.address ? ` · ${v.address}` : ''}</AppText>
                  <StatusChip code={v.status} />
                </Card>

                {v.reviewNote ? (
                  <Card style={{ backgroundColor: colors.secondaryBg, borderColor: colors.secondaryBg }}>
                    <AppText variant="small" color="onSecondary">Phường: {v.reviewNote}</AppText>
                  </Card>
                ) : null}

                <Section title="Tiến trình">
                  <Card style={styles.timeline}>
                    {steps.map((s) => (
                      <View key={s.label} style={styles.step}>
                        <Icon
                          name={s.done ? 'check-circle' : s.current ? 'alert-circle' : 'circle-outline'}
                          size={22}
                          color={s.done ? 'tertiary' : s.current ? 'secondary' : 'muted'}
                        />
                        <AppText variant="label" style={styles.stepLabel}>{s.label}</AppText>
                        {s.at ? <AppText variant="small" color="muted">{s.at}</AppText> : null}
                      </View>
                    ))}
                  </Card>
                </Section>

                <Section title="Giấy tờ">
                  <KeyValueCard
                    rows={
                      v.evidence.length
                        ? v.evidence.map((e) => ({ label: e.label, node: <StatusChip label="Đã nhận" tone="ok" /> }))
                        : [{ label: 'Chưa có giấy tờ', value: '' }]
                    }
                  />
                </Section>
              </>
            );
          }}
        </QueryView>
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Rút hồ sơ?"
        description="Hồ sơ sẽ không được xét duyệt nữa."
        confirmLabel="Rút hồ sơ"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          if (r)
            withdraw.mutateAsync(r.id).then(() => {
              showToast('Đã rút hồ sơ');
              goRoot('/vendor/registrations');
            }, showError);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  timeline: { gap: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepLabel: { flex: 1 },
});

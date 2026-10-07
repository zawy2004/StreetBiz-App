import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goRoot, goTo } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

const TYPE_LABEL = { FIXED_STOREFRONT: 'Cửa hàng cố định', ITINERANT: 'Bán hàng lưu động' } as const;

export default function RegistrationDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const registration = useMockDb((s) => s.registrations).find((r) => r.id === id);
  const withdraw = useMockDb((s) => s.withdrawRegistration);
  const [confirm, setConfirm] = useState(false);

  if (!registration) {
    return (
      <>
        <StackHeader title="Hồ sơ" />
        <Screen><EmptyState title="Không tìm thấy hồ sơ" /></Screen>
      </>
    );
  }

  const status = registration.registration_status;
  const needMore = status === 'MORE_INFORMATION_REQUIRED';
  const closed = ['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(status);
  const steps = [
    { label: 'Đã nộp', at: formatDate(registration.submitted_at), done: true },
    { label: 'Đang xét', done: status !== 'SUBMITTED' && status !== 'PENDING' },
    {
      label: needMore ? 'Cần bổ sung' : status === 'REJECTED' ? 'Bị từ chối' : status === 'WITHDRAWN' ? 'Đã rút' : 'Đã duyệt',
      done: closed,
      current: needMore,
    },
  ];

  return (
    <>
      <StackHeader title="Hồ sơ" />
      <Screen
        footer={
          needMore ? (
            <Button label="Bổ sung giấy tờ" onPress={() => goTo(`/vendor/registrations/${registration.id}/evidence`)} />
          ) : status === 'APPROVED' ? (
            <Button label="Đổi địa chỉ" variant="outline" onPress={() => goTo(`/vendor/registrations/${registration.id}/address`)} />
          ) : !closed ? (
            <Button label="Rút hồ sơ" variant="danger" onPress={() => setConfirm(true)} />
          ) : undefined
        }
      >
        <Card style={styles.head}>
          <AppText variant="title">{registration.business_name || registration.owner_name}</AppText>
          <AppText variant="small" color="muted">{TYPE_LABEL[registration.vendor_type]}</AppText>
          <StatusChip code={status} />
        </Card>

        {registration.review_note ? (
          <Card style={[styles.note, { backgroundColor: colors.secondaryBg, borderColor: colors.secondary }]}>
            <AppText variant="small" color="onSecondary">{registration.review_note}</AppText>
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
              registration.evidence.length
                ? registration.evidence.map((e) => ({ label: e.label, node: <StatusChip label="Đã nhận" tone="ok" /> }))
                : [{ label: 'Chưa có giấy tờ', value: '' }]
            }
          />
        </Section>
      </Screen>
      <ConfirmDialog
        visible={confirm}
        title="Rút hồ sơ?"
        description="Hồ sơ sẽ không được xét duyệt nữa."
        confirmLabel="Rút hồ sơ"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          withdraw(registration.id);
          setConfirm(false);
          goRoot('/vendor/registrations');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  note: { borderWidth: 1 },
  timeline: { gap: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepLabel: { flex: 1 },
});

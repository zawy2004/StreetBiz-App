import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useRegistrationDraft } from '@/features/registration/registration-draft';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

const TYPE_LABEL = { FIXED_STOREFRONT: 'Cửa hàng cố định', ITINERANT: 'Bán hàng lưu động' } as const;

export default function RegistrationsScreen() {
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const registrations = useMockDb((s) => s.registrations).filter((r) => r.vendorId === vendorId);
  const resetDraft = useRegistrationDraft((s) => s.reset);

  const start = () => {
    resetDraft();
    goTo('/vendor/registrations/new/type');
  };

  return (
    <>
      <StackHeader title="Hồ sơ đăng ký" />
      <Screen footer={registrations.length ? <Button label="Đăng ký thêm" icon="plus" onPress={start} /> : undefined}>
        {registrations.length ? (
          registrations.map((r) => (
            <Card key={r.id} onPress={() => goTo(`/vendor/registrations/${r.id}`)} style={styles.row}>
              <View style={styles.body}>
                <AppText variant="headline">{r.business_name || r.owner_name}</AppText>
                <AppText variant="small" color="muted">{TYPE_LABEL[r.vendor_type]} · nộp {formatDate(r.submitted_at)}</AppText>
                <StatusChip code={r.registration_status} />
              </View>
              <Icon name="chevron-right" size={22} color="muted" />
            </Card>
          ))
        ) : (
          <>
            <EmptyState icon="file-document-outline" title="Chưa có hồ sơ" />
            <Button label="Đăng ký ngay" onPress={start} />
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
});

import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useRegistrationDraft } from '@/features/registration/registration-draft';
import { useRegistrations } from '@/features/registration/use-registrations';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

const TYPE_LABEL = { FIXED_STOREFRONT: 'Cửa hàng cố định', ITINERANT: 'Bán hàng lưu động' } as const;

/** REG-03: the vendor's business registrations. */
export default function RegistrationsScreen() {
  const registrations = useRegistrations();
  const resetDraft = useRegistrationDraft((s) => s.reset);

  const start = () => {
    resetDraft();
    goTo('/vendor/registrations/new/type');
  };

  return (
    <>
      <StackHeader title="Hồ sơ đăng ký" />
      <Screen
        onRefresh={registrations.refetch}
        refreshing={registrations.isRefetching}
        footer={registrations.data?.length ? <Button label="Đăng ký thêm" icon="plus" onPress={start} /> : undefined}
      >
        <QueryView query={registrations}>
          {(list) =>
            list.length ? (
              list.map((r) => (
                <Card key={r.id} onPress={() => goTo(`/vendor/registrations/${r.id}`)} style={styles.row}>
                  <View style={styles.body}>
                    <AppText variant="headline">{r.name}</AppText>
                    <AppText variant="small" color="muted">{TYPE_LABEL[r.vendorType]} · nộp {formatDate(r.submittedAt)}</AppText>
                    <StatusChip code={r.status} />
                  </View>
                  <Icon name="chevron-right" size={22} color="muted" />
                </Card>
              ))
            ) : (
              <EmptyState icon="file-document-outline" title="Chưa có hồ sơ" description="Đăng ký hộ kinh doanh để được thuê ô vỉa hè và mở gian hàng.">
                <Button label="Đăng ký ngay" onPress={start} />
              </EmptyState>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: spacing.xs },
});

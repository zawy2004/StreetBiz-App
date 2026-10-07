import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useFoodSafetyList } from '@/features/storefront/use-store';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

/** ATTP filings: the ward checks them and forwards them to Chi cục ATTP. */
export default function FoodSafetyListScreen() {
  const files = useFoodSafetyList();

  return (
    <>
      <StackHeader title="An toàn thực phẩm" />
      <Screen
        onRefresh={files.refetch}
        refreshing={files.isRefetching}
        footer={<Button label="Nộp hồ sơ" icon="file-upload-outline" onPress={() => goTo('/vendor/store/food-safety/new')} />}
      >
        <QueryView query={files}>
          {(list) =>
            list.length ? (
              list.map((f) => (
                <Card key={f.id} style={styles.card}>
                  <View style={styles.row}>
                    <AppText variant="label" style={styles.flex}>{f.title}</AppText>
                    <StatusChip code={f.status} />
                  </View>
                  <AppText variant="small" color="muted">Nộp {formatDate(f.submittedAt)}</AppText>
                  {f.dishes.length ? <AppText variant="small" color="muted">Món: {f.dishes.join(', ')}</AppText> : null}
                  {f.note ? <AppText variant="small" color="onSecondary">Phường: {f.note}</AppText> : null}
                </Card>
              ))
            ) : (
              <EmptyState icon="shield-outline" title="Chưa có hồ sơ" description="Món thuộc danh mục cần ATTP chỉ hiện với người mua sau khi chứng nhận được duyệt." />
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  flex: { flex: 1 },
});

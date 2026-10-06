import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useFoodSafety } from '@/features/food-safety/food-safety-store';
import { spacing } from '@/theme';
import { formatDate } from '@/utils/format';

export default function FoodSafetyListScreen() {
  const files = useFoodSafety((s) => s.files);

  return (
    <>
      <StackHeader title="An toàn thực phẩm" />
      <Screen footer={<Button label="Nộp hồ sơ" onPress={() => goTo('/vendor/store/food-safety/new')} />}>
        {files.length ? (
          files.map((f) => (
            <Card key={f.id} style={styles.card}>
              <View style={styles.row}>
                <AppText variant="label">{f.title}</AppText>
                <StatusChip code={f.status} />
              </View>
              <AppText variant="small" color="muted">Nộp {formatDate(f.submittedAt)}</AppText>
            </Card>
          ))
        ) : (
          <EmptyState icon="shield-outline" title="Chưa có hồ sơ" />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
});

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ListRow } from '@/components/common/ListRow';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { StatusChip } from '@/components/status/StatusChip';
import { spacing } from '@/theme';

// Temporary design-system preview; replaced by the role-based redirect in the auth batch.
export default function IndexScreen() {
  const insets = useSafeAreaInsets();
  return (
    <Screen footer={<Button label="Nộp đơn thuê ô" onPress={() => undefined} />}>
      <View style={{ paddingTop: insets.top }}>
        <AppText variant="display">StreetBiz</AppText>
        <AppText color="muted">Bản xem thử thành phần giao diện</AppText>
      </View>

      <Card>
        <View style={styles.row}>
          <AppText variant="code">SB-HC1-2026-0815</AppText>
          <StatusChip code="VALID" />
        </View>
      </Card>

      <Section title="Việc cần làm">
        <Card padded={false}>
          <ListRow icon="file-document-outline" title="Bổ sung giấy tờ" subtitle="Hạn chót 24/10" onPress={() => undefined} />
          <ListRow icon="cash" title="Đóng phí thuê ô" trailing={<Money amountVnd={900000} />} onPress={() => undefined} />
        </Card>
      </Section>

      <View style={styles.buttons}>
        <Button label="Chính" onPress={() => undefined} />
        <Button label="Phụ" variant="civic" onPress={() => undefined} />
        <Button label="Viền" variant="outline" onPress={() => undefined} />
        <Button label="Nguy hiểm" variant="danger" onPress={() => undefined} />
      </View>

      <EmptyState title="Chưa có dữ liệu" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttons: { gap: spacing.sm },
});

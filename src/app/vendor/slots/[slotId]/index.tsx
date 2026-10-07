import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { Money } from '@/components/common/Money';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { radius, spacing, useTheme } from '@/theme';

export default function SlotDetailScreen() {
  const { colors } = useTheme();
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const slot = useMockDb((s) => s.slots).find((s) => s.id === slotId);

  if (!slot) {
    return (
      <>
        <StackHeader title="Chi tiết ô" />
        <Screen><EmptyState title="Không tìm thấy ô" /></Screen>
      </>
    );
  }

  const free = slot.slot_status === 'AVAILABLE';

  return (
    <>
      <StackHeader title={slot.slot_code} />
      <Screen
        footer={
          free ? (
            <Button label="Nộp đơn thuê" onPress={() => goTo(`/vendor/slots/${slot.id}/apply`)} />
          ) : (
            <Button label="Ô này chưa thể thuê" disabled onPress={() => undefined} />
          )
        }
      >
        <Card style={styles.place}>
          <View style={[styles.pin, { backgroundColor: colors.sunken }]}>
            <Icon name="map-marker-outline" size={26} color="primary" />
          </View>
          <View style={styles.placeBody}>
            <AppText variant="headline">{slot.street}</AppText>
            <AppText variant="small" color="muted">Phường Hải Châu 1</AppText>
          </View>
          <StatusChip code={slot.slot_status} />
        </Card>

        <View style={styles.tiles}>
          <Card style={styles.tile}>
            <AppText variant="small" color="muted">Phí thuê</AppText>
            <Money amountVnd={slot.price_monthly} color="primary" />
            <AppText variant="small" color="muted">/tháng</AppText>
          </Card>
          <Card style={styles.tile}>
            <AppText variant="small" color="muted">Diện tích</AppText>
            <AppText variant="money">{slot.size_m2} m²</AppText>
          </Card>
        </View>

        <Card style={styles.hours}>
          <Icon name="clock-outline" size={22} color="indigo" />
          <AppText variant="label">Giờ bán {slot.time_window}</AppText>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pin: { width: 48, height: 48, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  placeBody: { flex: 1 },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, gap: spacing.xs },
  hours: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

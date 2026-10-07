import { useLocalSearchParams } from 'expo-router';
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
import { useSlot } from '@/features/slots/use-rentals';
import { radius, spacing, useTheme } from '@/theme';

/** SIDE-02: one slot's place, size, price and hours. */
export default function SlotDetailScreen() {
  const { colors } = useTheme();
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const slot = useSlot(slotId);
  const s = slot.data;

  return (
    <>
      <StackHeader title={s?.code ?? 'Chi tiết ô'} />
      <Screen
        footer={
          s ? (
            s.status === 'AVAILABLE' ? (
              <Button label="Nộp đơn thuê" onPress={() => goTo(`/vendor/slots/${s.id}/apply`)} />
            ) : (
              <Button label="Ô này chưa thể thuê" disabled onPress={() => undefined} />
            )
          ) : undefined
        }
      >
        <QueryView query={slot}>
          {(v) =>
            !v ? (
              <EmptyState title="Không tìm thấy ô" />
            ) : (
              <>
                <Card style={styles.place}>
                  <View style={[styles.pin, { backgroundColor: colors.primarySoft }]}>
                    <Icon name="map-marker-outline" size={26} color="primary" />
                  </View>
                  <View style={styles.placeBody}>
                    <AppText variant="headline">{v.street}</AppText>
                    <AppText variant="small" color="muted">{v.lat.toFixed(5)}, {v.lng.toFixed(5)}</AppText>
                  </View>
                  <StatusChip code={v.status} />
                </Card>

                <View style={styles.tiles}>
                  <Card style={styles.tile}>
                    <AppText variant="small" color="muted">Phí thuê</AppText>
                    <AppText variant="money" color="primary">{v.priceLabel}</AppText>
                  </Card>
                  <Card style={styles.tile}>
                    <AppText variant="small" color="muted">Kích thước</AppText>
                    <AppText variant="money">{v.sizeLabel}</AppText>
                  </Card>
                </View>

                {v.timeWindow ? (
                  <Card style={styles.hours}>
                    <Icon name="clock-outline" size={22} color="indigo" />
                    <AppText variant="label">Giờ bán {v.timeWindow}</AppText>
                  </Card>
                ) : null}
                {v.tenantName ? <AppText variant="small" color="muted">Đang thuê: {v.tenantName}</AppText> : null}
              </>
            )
          }
        </QueryView>
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

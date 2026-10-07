import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { QrCode } from '@/components/common/QrCode';
import { EmptyState, QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { usePermit } from '@/features/slots/use-rentals';
import { spacing } from '@/theme';
import { daysUntil, formatDate } from '@/utils/format';

/** SIDE-08: the digital permit (signed QR) shown to ward officers and buyers. `id` is the contract. */
export default function PermitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const permit = usePermit(id);
  const p = permit.data;
  const valid = p?.status === 'VALID';

  return (
    <>
      <StackHeader title="Giấy phép số" />
      <Screen
        onRefresh={permit.refetch}
        refreshing={permit.isRefetching}
        footer={
          p && valid ? (
            <View style={styles.actions}>
              <View style={styles.half}>
                <Button label="Gia hạn" onPress={() => goTo(`/vendor/contracts/${p.contractId}/renewal`)} />
              </View>
              <View style={styles.half}>
                <Button label="Chuyển nhượng" variant="outline" onPress={() => goTo(`/vendor/contracts/${p.contractId}/transfer`)} />
              </View>
            </View>
          ) : undefined
        }
      >
        <QueryView query={permit}>
          {(v) => {
            if (!v) return <EmptyState icon="file-clock-outline" tone="secondary" title="Chưa có giấy phép" description="Phường chưa phát hành giấy phép QR cho hợp đồng này." />;
            const left = daysUntil(v.endDate);
            return (
              <>
                <View style={styles.center}>
                  <StatusChip code={v.status} />
                  <QrCode value={v.qr} size={240} />
                  <AppText variant="code">{v.displayCode}</AppText>
                  <View style={styles.hint}>
                    <Icon name="brightness-6" size={16} color="muted" />
                    <AppText variant="small" color="muted">Tăng độ sáng khi cho cán bộ quét</AppText>
                  </View>
                </View>

                <KeyValueCard
                  rows={[
                    { label: 'Hộ kinh doanh', value: v.vendorName },
                    { label: 'Ô cấp phép', value: [v.slotCode, v.street].filter(Boolean).join(' · ') },
                    {
                      label: 'Hiệu lực',
                      node: (
                        <View style={styles.validity}>
                          <AppText variant="label">{formatDate(v.startDate)} - {formatDate(v.endDate)}</AppText>
                          {v.status === 'VALID' && left >= 0 ? <StatusChip label={`Còn ${left} ngày`} tone={left <= 7 ? 'pending' : 'ok'} /> : null}
                        </View>
                      ),
                    },
                  ]}
                />
              </>
            );
          }}
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  validity: { alignItems: 'flex-end', gap: 4, flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
});

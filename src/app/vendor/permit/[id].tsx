import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { QrCode } from '@/components/common/QrCode';
import { EmptyState } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { spacing } from '@/theme';
import { daysUntil, formatDate } from '@/utils/format';

export default function PermitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const permit = useMockDb((s) => s.permits).find((p) => p.id === id);
  const contract = useMockDb((s) => s.contracts).find((c) => c.id === permit?.contractId);
  const slot = useMockDb((s) => s.slots).find((s) => s.id === contract?.slotId);
  const vendorId = useAuthStore((s) => s.user?.vendorId);
  const vendor = useMockDb((s) => s.vendors).find((v) => v.id === vendorId);

  if (!permit || !contract) {
    return (
      <>
        <StackHeader title="Giấy phép số" />
        <Screen><EmptyState title="Không tìm thấy giấy phép" /></Screen>
      </>
    );
  }

  const left = daysUntil(permit.expires_at);
  const valid = permit.permit_status === 'VALID';

  return (
    <>
      <StackHeader title="Giấy phép số" />
      <Screen
        footer={
          valid ? (
            <View style={styles.actions}>
              <View style={styles.half}>
                <Button label="Gia hạn" onPress={() => goTo(`/vendor/contracts/${contract.id}/renewal`)} />
              </View>
              <View style={styles.half}>
                <Button label="Chuyển nhượng" variant="outline" onPress={() => goTo(`/vendor/contracts/${contract.id}/transfer`)} />
              </View>
            </View>
          ) : undefined
        }
      >
        <View style={styles.center}>
          <StatusChip code={permit.permit_status} />
          <QrCode value={permit.permit_code} size={240} />
          <AppText variant="code">{permit.permit_code}</AppText>
          <View style={styles.hint}>
            <Icon name="brightness-6" size={16} color="muted" />
            <AppText variant="small" color="muted">Tăng độ sáng khi cho cán bộ quét</AppText>
          </View>
        </View>

        <KeyValueCard
          rows={[
            { label: 'Hộ kinh doanh', value: vendor?.business_name || vendor?.owner_name || '' },
            { label: 'Ô cấp phép', value: `${slot?.slot_code} · ${slot?.size_m2} m²` },
            {
              label: 'Hiệu lực',
              node: (
                <View style={styles.validity}>
                  <AppText variant="label">{formatDate(contract.start_date)} - {formatDate(permit.expires_at)}</AppText>
                  {valid && left >= 0 ? <StatusChip label={`Còn ${left} ngày`} tone={left <= 7 ? 'pending' : 'ok'} /> : null}
                </View>
              ),
            },
          ]}
        />
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

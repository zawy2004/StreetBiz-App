import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { spacing, useTheme } from '@/theme';
import { daysUntil, formatDate } from '@/utils/format';

export default function ScanResultScreen() {
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const permit = useMockDb((s) => s.permits).find((p) => p.permit_code.toLowerCase() === (code ?? '').toLowerCase());
  const contract = useMockDb((s) => s.contracts).find((c) => c.id === permit?.contractId);
  const vendor = useMockDb((s) => s.vendors).find((v) => v.id === contract?.vendorId);
  const slot = useMockDb((s) => s.slots).find((s) => s.id === contract?.slotId);

  const valid = !!permit && !!vendor && permit.permit_status === 'VALID' && daysUntil(permit.expires_at) >= 0;

  return (
    <>
      <StackHeader title="Kết quả" />
      <Screen
        footer={
          valid && vendor ? (
            <>
              <Button label="Xem hồ sơ hộ kinh doanh" onPress={() => goTo(`/customer/vendors/${vendor.id}`)} />
              <Button label="Báo cáo bất thường" variant="outline" onPress={() => goTo(`/customer/vendors/${vendor.id}/report`)} />
            </>
          ) : (
            <>
              <Button label="Quét lại" onPress={() => router.back()} />
              {vendor ? <Button label="Báo cáo hộ này" variant="outline" onPress={() => goTo(`/customer/vendors/${vendor.id}/report`)} /> : null}
            </>
          )
        }
      >
        <View style={styles.hero}>
          <View style={[styles.circle, { backgroundColor: valid ? colors.tertiary : colors.error }]}>
            <Icon name={valid ? 'check' : 'close'} size={44} color="#FFFFFF" />
          </View>
          <AppText variant="display" align="center">
            {valid ? 'Giấy phép hợp lệ' : permit ? 'Giấy phép hết hiệu lực' : 'Mã không hợp lệ'}
          </AppText>
          {!permit ? <AppText color="muted" align="center">Không tìm thấy giấy phép cho mã này</AppText> : null}
        </View>

        {permit && vendor ? (
          <>
            <View style={styles.name}>
              <AppText variant="title">{vendor.business_name || vendor.owner_name}</AppText>
              <StatusChip code={valid ? 'VALID' : permit.permit_status === 'VALID' ? 'EXPIRED' : permit.permit_status} />
            </View>
            <KeyValueCard
              rows={[
                { label: 'Ô cấp phép', value: slot ? `${slot.slot_code} · ${slot.street}` : '' },
                { label: 'Diện tích', value: slot ? `${slot.size_m2} m²` : '' },
                { label: 'Hiệu lực đến', value: formatDate(permit.expires_at) },
              ]}
            />
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  circle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  name: { gap: spacing.sm },
});

import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KeyValueCard } from '@/components/common/KeyValueCard';
import { QueryView } from '@/components/feedback/States';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { goTo } from '@/core/navigation/go';
import { useVerifyPermit } from '@/features/discovery/use-discovery';
import { spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

/** BUY-02: what a scanned permit QR says about the stall in front of the buyer. */
export default function ScanResultScreen() {
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const check = useVerifyPermit(code);
  const result = check.data;

  return (
    <>
      <StackHeader title="Kết quả" />
      <Screen
        footer={
          result?.valid && result.vendorId ? (
            <>
              <Button label="Xem hồ sơ hộ kinh doanh" onPress={() => goTo(`/customer/vendors/${result.vendorId}`)} />
              <Button label="Báo cáo bất thường" variant="outline" onPress={() => goTo(`/customer/vendors/${result.vendorId}/report`)} />
            </>
          ) : (
            <>
              <Button label="Quét lại" onPress={() => router.back()} />
              {result?.vendorId ? <Button label="Báo cáo hộ này" variant="outline" onPress={() => goTo(`/customer/vendors/${result.vendorId}/report`)} /> : null}
            </>
          )
        }
      >
        <QueryView query={check} loadingLabel="Đang kiểm tra giấy phép…">
          {(r) => (
            <>
              <View style={styles.hero}>
                <View style={[styles.circle, { backgroundColor: r.valid ? colors.tertiary : colors.error }]}>
                  <Icon name={r.valid ? 'check' : 'close'} size={44} color="#FFFFFF" />
                </View>
                <AppText variant="display" align="center">
                  {r.valid ? 'Giấy phép hợp lệ' : r.found ? 'Giấy phép không còn hiệu lực' : 'Mã không hợp lệ'}
                </AppText>
                {!r.found ? <AppText color="muted" align="center">Không tìm thấy giấy phép cho mã này</AppText> : null}
              </View>

              {r.found && r.name ? (
                <>
                  <View style={styles.name}>
                    <AppText variant="title">{r.name}</AppText>
                    <StatusChip code={r.status} />
                  </View>
                  <KeyValueCard
                    rows={[
                      ...(r.slotCode ? [{ label: 'Ô cấp phép', value: [r.slotCode, r.street].filter(Boolean).join(' · ') }] : []),
                      ...(r.validUntil ? [{ label: 'Hiệu lực đến', value: formatDate(r.validUntil) }] : []),
                    ]}
                  />
                </>
              ) : null}
            </>
          )}
        </QueryView>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  circle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  name: { gap: spacing.sm },
});

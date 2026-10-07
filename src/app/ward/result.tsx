import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { EmptyState } from '@/components/feedback/States';
import { goTo } from '@/core/navigation/go';
import { useMockDb } from '@/mocks/db';
import { radius, spacing, useTheme } from '@/theme';
import { daysUntil, formatDate } from '@/utils/format';
import { distanceMeters } from '@/utils/geo';

export default function PatrolResultScreen() {
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const permit = useMockDb((s) => s.permits).find((p) => p.permit_code.toLowerCase() === (code ?? '').toLowerCase());
  const contract = useMockDb((s) => s.contracts).find((c) => c.id === permit?.contractId);
  const vendor = useMockDb((s) => s.vendors).find((v) => v.id === contract?.vendorId);
  const slot = useMockDb((s) => s.slots).find((s) => s.id === contract?.slotId);
  const [photo, setPhoto] = useState<string>();
  const [offset, setOffset] = useState<number>();

  useEffect(() => {
    if (!slot) return;
    let cancelled = false;
    void (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = await Location.getCurrentPositionAsync({});
        if (!cancelled) setOffset(distanceMeters({ lat: pos.coords.latitude, lng: pos.coords.longitude }, slot));
      } catch {
        // No GPS fix: the location row is simply not shown.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slot]);

  if (!permit || !vendor || !contract) {
    return (
      <>
        <StackHeader title="Tuần tra" />
        <Screen footer={<Button label="Quét lại" onPress={() => router.back()} />}>
          <EmptyState icon="qrcode-remove" title="Không tìm thấy giấy phép" description="Mã này không có trong hệ thống." />
        </Screen>
      </>
    );
  }

  const valid = permit.permit_status === 'VALID' && daysUntil(permit.expires_at) >= 0;
  const q = `vendorId=${vendor.id}&slotId=${slot?.id ?? ''}&permitId=${permit.id}`;

  return (
    <>
      <StackHeader title="Tuần tra" />
      <Screen
        footer={
          <>
            <Button label="Lập biên bản" onPress={() => goTo(`/ward/violation/new?${q}`)} />
            <Button label="Đình chỉ" variant="danger" onPress={() => goTo(`/ward/permit-action?permitId=${permit.id}`)} />
          </>
        }
      >
        <Card style={styles.info}>
          <View style={styles.head}>
            <AppText variant="title" style={styles.name}>{vendor.business_name || vendor.owner_name}</AppText>
            <StatusChip code={valid ? 'VALID' : permit.permit_status === 'VALID' ? 'EXPIRED' : permit.permit_status} />
          </View>
          <View style={[styles.rule, { backgroundColor: colors.border }]} />
          <Row label="Ô cấp phép" value={slot ? `${slot.slot_code} · ${slot.size_m2} m²` : ''} />
          <Row label="Hiệu lực" value={`đến ${formatDate(permit.expires_at)}`} />
          {offset !== undefined ? (
            <View style={[styles.gps, { backgroundColor: offset <= 25 ? colors.tertiaryBg : colors.errorBg }]}>
              <Icon name="crosshairs-gps" size={18} color={offset <= 25 ? 'tertiary' : 'error'} />
              <AppText variant="label" color={offset <= 25 ? 'tertiary' : 'error'}>
                {offset <= 25 ? `Vị trí khớp ô (cách ${offset} m)` : `Lệch ô cấp phép ${offset} m`}
              </AppText>
            </View>
          ) : null}
        </Card>

        <View style={styles.photo}>
          <AppText variant="labelSm">Ảnh hiện trường</AppText>
          <PhotoSlot uri={photo} onChange={setPhoto} label="Chụp ảnh" size={96} />
        </View>

        {photo ? (
          <Card style={[styles.ai, { backgroundColor: colors.secondaryBg, borderColor: colors.secondary }]}>
            <AppText variant="labelSm" color="onSecondary">Gợi ý AI · tin cậy 91%</AppText>
            <AppText color="onSecondary">Có dấu hiệu lấn khoảng 35 cm. Cần đối chiếu thực địa.</AppText>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="small" color="muted">{label}</AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}


const styles = StyleSheet.create({
  info: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  name: { flex: 1 },
  rule: { height: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  gps: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.control },
  photo: { gap: spacing.sm },
  ai: { borderWidth: 1, gap: spacing.xs },
});

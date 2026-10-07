import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Icon } from '@/components/common/Icon';
import { EmptyState, LoadingState, QueryView } from '@/components/feedback/States';
import { PhotoSlot } from '@/components/forms/PhotoSlot';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { StatusChip } from '@/components/status/StatusChip';
import { isLiveApi } from '@/core/config/env';
import { goTo } from '@/core/navigation/go';
import { useInspectPermit } from '@/features/violation/use-patrol';
import { useViolationDraft } from '@/features/violation/violation-draft';
import { radius, spacing, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';

/** WARD-07: what a scanned permit says, and whether the stall stands on its slot. */
export default function PatrolResultScreen() {
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const draft = useViolationDraft();
  const [at, setAt] = useState<{ latitude: number; longitude: number }>();
  const [located, setLocated] = useState(false);

  // Try for a GPS fix first, so the backend can compare it with the slot; inspect either way.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const pos = await Location.getCurrentPositionAsync({});
          if (!cancelled) setAt({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch {
        // No GPS fix: the location row is simply not shown.
      } finally {
        if (!cancelled) setLocated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inspection = useInspectPermit(located ? code : undefined, at);
  const r = inspection.data;

  if (!located) {
    return (
      <>
        <StackHeader title="Tuần tra" />
        <Screen><LoadingState label="Đang lấy vị trí…" /></Screen>
      </>
    );
  }

  const params = r ? new URLSearchParams({ vendorId: r.vendorId ?? '', slotId: r.slotId ?? '', permitId: r.permitId ?? '', contractId: r.contractId ?? '', name: r.vendorName ?? '', slot: r.slotLabel ?? '' }).toString() : '';
  const photo = draft.photos[0];

  return (
    <>
      <StackHeader title="Tuần tra" />
      <Screen
        footer={
          r?.found ? (
            <>
              <Button label="Lập biên bản" onPress={() => goTo(`/ward/violation/new?${params}`)} />
              {r.permitId ? <Button label="Đình chỉ / thu hồi" variant="danger" onPress={() => goTo(`/ward/permit-action?${params}&status=${r.status}`)} /> : null}
            </>
          ) : (
            <Button label="Quét lại" onPress={() => router.back()} />
          )
        }
      >
        <QueryView query={inspection} loadingLabel="Đang kiểm tra giấy phép…">
          {(v) =>
            !v.found ? (
              <EmptyState icon="qrcode-remove" tone="error" title="Không tìm thấy giấy phép" description="Mã này không có trong hệ thống." />
            ) : (
              <>
                <Card style={styles.info}>
                  <View style={styles.head}>
                    <AppText variant="title" style={styles.name}>{v.vendorName}</AppText>
                    <StatusChip code={v.status} />
                  </View>
                  <View style={[styles.rule, { backgroundColor: colors.border }]} />
                  {v.slotLabel ? <Row label="Ô cấp phép" value={v.slotLabel} /> : null}
                  {v.validUntil ? <Row label="Hiệu lực" value={`đến ${formatDate(v.validUntil)}`} /> : null}
                  {v.offsetM !== undefined ? (
                    <View style={[styles.gps, { backgroundColor: v.locationOk ? colors.tertiaryBg : colors.errorBg }]}>
                      <Icon name="crosshairs-gps" size={18} color={v.locationOk ? 'tertiary' : 'error'} />
                      <AppText variant="label" color={v.locationOk ? 'tertiary' : 'error'} style={styles.flex}>
                        {v.locationOk ? `Vị trí khớp ô (cách ${v.offsetM} m)` : (v.locationWarning ?? `Lệch ô cấp phép ${v.offsetM} m`)}
                      </AppText>
                    </View>
                  ) : null}
                </Card>

                <View style={styles.photo}>
                  <AppText variant="labelSm">Ảnh hiện trường</AppText>
                  <PhotoSlot uri={photo} onChange={(u) => draft.patch({ photos: [u, ...draft.photos.slice(1)] })} label="Chụp ảnh" size={96} />
                </View>

                {photo && !isLiveApi ? (
                  <Card style={[styles.ai, { backgroundColor: colors.secondaryBg, borderColor: colors.secondary }]}>
                    <AppText variant="labelSm" color="onSecondary">Gợi ý AI · tin cậy 91%</AppText>
                    <AppText color="onSecondary">Có dấu hiệu lấn khoảng 35 cm. Cần đối chiếu thực địa.</AppText>
                  </Card>
                ) : null}
              </>
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="small" color="muted">{label}</AppText>
      <AppText variant="label" style={styles.value}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  info: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  name: { flex: 1 },
  rule: { height: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  value: { flexShrink: 1, textAlign: 'right' },
  flex: { flex: 1 },
  gps: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.control },
  photo: { gap: spacing.sm },
  ai: { borderWidth: 1, gap: spacing.xs },
});

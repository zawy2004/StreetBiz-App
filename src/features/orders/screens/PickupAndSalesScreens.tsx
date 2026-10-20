import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, Stack, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Card, KeyValueList, StatTile } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { SegmentedControl } from '@/components/native/SegmentedControl';
import { errorMessage } from '@/core/api';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Pass, Signboard } from '@/ui';
import { formatShortMoney, formatVnd } from '@/utils/format';
import { activeDays, bestBucket, bucketLabel, fillDailyBuckets, presetRange, refundRate, shortKey, toUtc, type RangePreset } from '@/features/storefronts/sales-view';
import { orderApi } from '../api/orderApi';
import { useOnline } from '../components/order-display';
import { formatOrderDate } from '../components/order-format';
import { orderKeys } from '../hooks/useOrders';
import type { Order, SalesGroup } from '../types/order.types';

const SCAN_REARM_MS = 1500;
/** The dark of a camera that has not started yet (and around the permission prompt). */
const VIEWFINDER_BG = '#0E151F';

/** Four orange corner brackets around where the buyer's QR goes; mango while the server checks, red on a refusal. */
function Brackets({ busy, failed }: { busy: boolean; failed: boolean }) {
  const c = failed ? colors.danger : busy ? colors.sticker : colors.brand;
  const arm = { position: 'absolute' as const, width: 46, height: 46, borderColor: c };
  return (
    <View style={{ width: 210, height: 210 }}>
      <View style={[arm, { left: 0, top: 0, borderLeftWidth: 6, borderTopWidth: 6, borderTopLeftRadius: radius.card }]} />
      <View style={[arm, { right: 0, top: 0, borderRightWidth: 6, borderTopWidth: 6, borderTopRightRadius: radius.card }]} />
      <View style={[arm, { left: 0, bottom: 0, borderLeftWidth: 6, borderBottomWidth: 6, borderBottomLeftRadius: radius.card }]} />
      <View style={[arm, { right: 0, bottom: 0, borderRightWidth: 6, borderBottomWidth: 6, borderBottomRightRadius: radius.card }]} />
    </View>
  );
}

/**
 * Quét mã nhận hàng (ORD-06), v5: the camera runs edge to edge with orange corner brackets; a
 * white sheet rises over it with the typed fallback. The code names the order, so one scan hands
 * it over; a second scan of the same code is refused by the server, which is the point. Handed
 * over, the top turns leaf green and the order comes back as its slip.
 */
export function VendorPickupScanScreen() {
  const cache = useQueryClient();
  const online = useOnline();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [handedOver, setHandedOver] = useState<Order | null>(null);
  const [tally, setTally] = useState(0);
  const lastScan = useRef<{ token: string; at: number } | null>(null);

  const handOver = useMutation({
    mutationFn: ({ token, code }: { token?: string; code?: string }) => (token ? orderApi.scanPickup(token) : orderApi.confirmPickupByCode(code!)),
    onSuccess: async (order) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHandedOver(order);
      setManual('');
      setTally((n) => n + 1);
      await Promise.all([cache.invalidateQueries({ queryKey: orderKeys.vendorLists }), cache.invalidateQueries({ queryKey: orderKeys.vendorDetail(order.orderId) })]);
    },
    onError: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  });
  const paused = handOver.isPending || !!handedOver || !online;
  const onScanned = ({ data }: { data: string }) => {
    if (paused) return;
    const now = Date.now();
    // The camera reports the same code many times a second: one attempt per code until re-armed.
    if (lastScan.current && lastScan.current.token === data && now - lastScan.current.at < SCAN_REARM_MS) return;
    if (handOver.isError && lastScan.current?.token === data) return;
    lastScan.current = { token: data, at: now };
    handOver.mutate({ token: data });
  };
  const reset = () => {
    setHandedOver(null);
    handOver.reset();
    lastScan.current = null;
  };

  if (handedOver) {
    return (
      <Screen padded={false} gap={20} footer={<Button label="Quét đơn tiếp theo" size={56} icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={reset} />}>
        <Stack.Screen options={{ title: 'Đã giao đơn' }} />
        <Signboard
          compact
          color={colors.leaf}
          kerb={false}
          line2Color={colors.white}
          top={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="checkmark" md="check" size={24} color={colors.leaf} weight="bold" />
              </View>
              {tally > 1 ? <Text style={[{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.white }, tabular]}>Đã giao {tally} đơn trong lần quét này</Text> : null}
            </View>
          }
          line1="Đã giao đơn"
          line2="tận tay khách"
          overlap={
            <Pass
              accent={colors.leaf}
              head={
                <View style={{ gap: 6 }}>
                  <Text maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit style={[sign.title, { color: colors.ink }, tabular]}>#{handedOver.orderCode}</Text>
                  <Text style={[text.title3, { color: colors.ink }]}>{handedOver.customerName || 'Khách hàng'}</Text>
                </View>
              }
              stub={
                <View style={{ gap: 8 }}>
                  {handedOver.items.map((it) => (
                    <View key={it.orderItemId} style={{ flexDirection: 'row', gap: 10 }}>
                      <Text style={[{ fontFamily: fonts.code, fontSize: 18, lineHeight: 23, color: colors.primary, minWidth: 32 }, tabular]}>{it.quantity}×</Text>
                      <Text style={[text.body, { flex: 1, color: colors.ink }]}>{it.itemName}</Text>
                    </View>
                  ))}
                  <KeyValueList rows={[{ label: 'Tổng tiền', value: formatVnd(handedOver.totalAmount), emphasis: true }, handedOver.completedAt ? { label: 'Giao lúc', value: formatOrderDate(handedOver.completedAt) } : null]} />
                </View>
              }
            />
          }
        />
        <View style={{ paddingHorizontal: 20 }}>
          <Button label="Xem chi tiết đơn" variant="secondary" onPress={() => router.push(`/vendor/orders/${handedOver.orderId}` as Href)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} gap={0}>
      <Stack.Screen options={{ title: 'Quét mã nhận hàng' }} />
      {/* The viewfinder, full bleed */}
      <View style={{ minHeight: 340, backgroundColor: VIEWFINDER_BG }}>
        {permission?.granted ? <CameraView style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={paused ? undefined : onScanned} /> : null}
        <View pointerEvents="box-none" style={{ flex: 1, minHeight: 340, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48, gap: 16 }}>
          {!permission ? (
            <ActivityIndicator color={colors.white} accessibilityLabel="Đang mở camera" />
          ) : !permission.granted ? (
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="camera.fill" md="photo_camera" size={30} color={colors.white} />
              </View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 22, color: colors.white, textAlign: 'center' }}>Cho phép dùng camera để quét mã nhận hàng của khách.</Text>
              {permission.canAskAgain ? (
                <Button label="Cho phép camera" onPress={() => void requestPermission()} />
              ) : (
                <Button label="Mở Cài đặt" onPress={() => void Linking.openSettings()} />
              )}
            </View>
          ) : (
            <>
              <Brackets busy={handOver.isPending} failed={handOver.isError && !!handOver.variables?.token} />
              <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 34, borderRadius: radius.full, backgroundColor: handOver.isPending ? colors.sticker : 'rgba(17, 28, 43, 0.72)' }}>
                {handOver.isPending ? <ActivityIndicator size="small" color={colors.plate} /> : <Icon sf="qrcode.viewfinder" md="qr_code_scanner" size={16} color={colors.white} />}
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: handOver.isPending ? colors.plate : colors.white }}>
                  {handOver.isPending ? 'Đang kiểm tra mã…' : 'Đưa mã QR của khách vào khung'}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* The sheet that rises over the camera */}
      <View style={{ marginTop: -26, borderTopLeftRadius: radius.pass, borderTopRightRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 12, gap: 16 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
        {!online ? <Banner tone="warning">Mất kết nối. Mã cần được kiểm với máy chủ, chưa giao được.</Banner> : null}
        {handOver.isError && handOver.variables?.token ? (
          <Banner tone="danger" title="Không giao được" action={{ label: 'Quét lại', onPress: reset }}>
            {errorMessage(handOver.error)}
          </Banner>
        ) : null}
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>Hoặc nhập mã khách đọc</Text>
        <TextField
          label="Mã nhận hàng"
          hint="8 ký tự in dưới mã QR trên máy khách."
          value={manual}
          onChangeText={(v) => setManual(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="VD: 7K2M9QXP"
          maxLength={12}
          editable={!handOver.isPending}
        />
        <Button label="Xác nhận giao đơn" loading={handOver.isPending && !!handOver.variables?.code} disabled={!manual.trim() || !online} onPress={() => handOver.mutate({ code: manual.trim() })} />
        {handOver.isError && handOver.variables?.code ? <Banner tone="danger">{errorMessage(handOver.error)}</Banner> : null}
        <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="questionmark" md="help" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>Khách không có mã?</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>Mở đơn trong bảng bếp và chọn “Khách không có mã?”. Lý do được ghi vào lịch sử đơn.</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const PRESETS: { kind: RangePreset; label: string }[] = [
  { kind: 'week', label: '7 ngày' },
  { kind: 'month30', label: '30 ngày' },
  { kind: 'thisMonth', label: 'Tháng này' },
  { kind: 'lastMonth', label: 'Tháng trước' },
];
const UNIT: Record<SalesGroup, string> = { day: 'ngày', week: 'tuần', month: 'tháng' };

/**
 * V37 Doanh thu (ORD-07), v5: completed orders only. The money actually received is painted on an
 * orange board in sign figures; the bars rise in orange, the best one solid with a mango tag.
 */
export function SalesSummaryScreen() {
  const [preset, setPreset] = useState<RangePreset>('week');
  const [groupBy, setGroupBy] = useState<SalesGroup>('day');
  const { fromDate, toDate } = useMemo(() => presetRange(preset, new Date()), [preset]);
  const fromUtc = toUtc(fromDate);
  const toUtcValue = toUtc(toDate, true);
  const summary = useQuery({
    queryKey: orderKeys.sales(fromUtc, toUtcValue, groupBy),
    queryFn: () => orderApi.salesSummary(fromUtc, toUtcValue, groupBy),
  });
  const buckets = useMemo(() => {
    const b = summary.data?.buckets ?? [];
    return groupBy === 'day' ? fillDailyBuckets(b, fromDate, toDate) : b;
  }, [summary.data, groupBy, fromDate, toDate]);
  const best = bestBucket(summary.data?.buckets ?? []);
  const max = Math.max(1, ...buckets.map((b) => b.netSales));
  const rate = summary.data ? refundRate(summary.data) : null;

  return (
    <Screen onRefresh={() => void summary.refetch()} refreshing={summary.isRefetching} gap={18}>
      <Stack.Screen options={{ title: 'Doanh thu' }} />
      <View style={{ gap: 10 }}>
        <SegmentedControl<RangePreset> value={preset} onChange={setPreset} options={PRESETS.map((p) => ({ key: p.kind, label: p.label }))} />
        <SegmentedControl<SalesGroup>
          value={groupBy}
          onChange={setGroupBy}
          options={[
            { key: 'day', label: 'Theo ngày' },
            { key: 'week', label: 'Theo tuần' },
            { key: 'month', label: 'Theo tháng' },
          ]}
        />
      </View>
      {summary.isPending ? (
        <View style={{ gap: 14 }} accessibilityLabel="Đang tải">
          <Skeleton height={150} radius={radius.card} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton height={110} radius={radius.card} style={{ flex: 1 }} />
            <Skeleton height={110} radius={radius.card} style={{ flex: 1 }} />
          </View>
          <Skeleton height={220} radius={radius.card} />
        </View>
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <>
          {/* The money received, painted on the stall's board */}
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.brand, boxShadow: shadow.glow }}>
            <View style={{ padding: 20, gap: 4 }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.white }}>Doanh thu thực nhận</Text>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, { color: colors.white }, tabular]}>
                {formatVnd(summary.data.netSales)}
              </Text>
              <Text style={[{ fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.plate }, tabular]}>
                {summary.data.completedOrderCount} đơn hoàn thành, {activeDays(summary.data.buckets)} {UNIT[groupBy]} có bán
              </Text>
            </View>
            <KerbStrip height={8} segment={20} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatTile icon={{ sf: 'bag.fill', md: 'shopping_bag' }} value={formatVnd(summary.data.grossSales)} label="Tổng bán" />
            <StatTile
              icon={{ sf: 'arrow.uturn.backward', md: 'undo' }}
              value={formatVnd(summary.data.refundedAmount)}
              label={rate != null ? `Hoàn tiền, ${rate.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : 'Hoàn tiền'}
            />
          </View>
          {buckets.length === 0 || summary.data.completedOrderCount === 0 ? (
            <StateView icon={{ sf: 'chart.bar', md: 'bar_chart' }} tone="neutral" title="Chưa có đơn hoàn thành" body="Doanh thu chỉ tính đơn đã giao tận tay khách trong khoảng này." />
          ) : (
            <Card style={{ gap: 14, padding: 18 }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, color: colors.ink }}>Theo {UNIT[groupBy]}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'flex-end', minHeight: 196, paddingTop: 8 }}>
                {buckets.map((b) => {
                  const isBest = best?.key === b.key;
                  return (
                    <View key={b.key} accessible accessibilityLabel={`${bucketLabel(b.key)}: ${formatVnd(b.netSales)}, ${b.completedOrderCount} đơn${isBest ? ', cao nhất' : ''}`} style={{ minWidth: 34, alignItems: 'center', gap: 5 }}>
                      {b.netSales > 0 ? (
                        isBest ? (
                          <View style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: radius.sticker, backgroundColor: colors.sticker, transform: [{ rotate: '-4deg' }] }}>
                            <Text style={[{ fontFamily: fonts.code, fontSize: 12, color: colors.plate }, tabular]}>{formatShortMoney(b.netSales)}</Text>
                          </View>
                        ) : (
                          <Text style={[{ fontFamily: fonts.semibold, fontSize: 10, color: colors.muted }, tabular]}>{formatShortMoney(b.netSales)}</Text>
                        )
                      ) : null}
                      <View style={{ width: 24, height: Math.max(4, (b.netSales / max) * 128), borderRadius: radius.sticker, borderCurve: 'continuous', backgroundColor: isBest ? colors.cta : b.netSales > 0 ? colors.brandLight : colors.sunken }} />
                      <Text style={[{ fontFamily: isBest ? fonts.heavy : fonts.medium, fontSize: 10, color: isBest ? colors.primary : colors.muted }, tabular]}>{shortKey(b.key)}</Text>
                    </View>
                  );
                })}
              </ScrollView>
              {best ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.mangoTint }}>
                  <Icon sf="star.fill" md="star" size={16} color={colors.onMango} />
                  <Text style={[text.footnote, { flex: 1, color: colors.onMango }, tabular]}>
                    Bán tốt nhất: <Text style={{ fontFamily: fonts.bold }}>{bucketLabel(best.key)}</Text>, {formatVnd(best.netSales)} ({best.completedOrderCount} đơn)
                  </Text>
                </View>
              ) : null}
            </Card>
          )}
          <Pressable onPress={() => router.navigate('/vendor/finance' as Href)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card, boxShadow: shadow.card })}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="banknote.fill" md="payments" size={17} color={colors.primary} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>Phí thuê ô và tiền phạt ở Tài chính</Text>
            <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
          </Pressable>
        </>
      )}
    </Screen>
  );
}

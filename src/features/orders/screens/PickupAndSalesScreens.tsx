import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, Stack, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Card, KeyValueList, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { errorMessage } from '@/core/api';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatShortMoney, formatVnd } from '@/utils/format';
import { activeDays, bestBucket, bucketLabel, fillDailyBuckets, presetRange, refundRate, shortKey, toUtc, type RangePreset } from '@/features/storefronts/sales-view';
import { orderApi } from '../api/orderApi';
import { useOnline } from '../components/order-display';
import { formatOrderDate } from '../components/order-format';
import { orderKeys } from '../hooks/useOrders';
import type { Order, SalesGroup } from '../types/order.types';

const SCAN_REARM_MS = 1500;

/**
 * Quét mã nhận hàng (ORD-06): the camera reads the buyer's QR and the order is handed over in
 * one step (the code names the order); typing the 8 characters is the fallback. A second scan
 * of the same code is refused by the server, which is the point.
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
      <Screen footer={<Button label="Quét đơn tiếp theo" size={56} icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={reset} />}>
        <Stack.Screen options={{ title: 'Đã giao đơn' }} />
        <View style={{ padding: 22, gap: 12, alignItems: 'center', borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="checkmark" md="check" size={36} color={colors.white} weight="bold" />
          </View>
          <Text accessibilityRole="header" style={[text.title2, { color: colors.onLeaf }]}>Đã giao đơn</Text>
          <Text style={{ fontFamily: fonts.code, fontSize: 20, color: colors.ink }}>#{handedOver.orderCode}</Text>
          <Text style={[text.callout, { color: colors.ink }]}>{handedOver.customerName || 'Khách hàng'}</Text>
        </View>
        <Card style={{ gap: 8 }}>
          {handedOver.items.map((it) => (
            <View key={it.orderItemId} style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={[{ fontFamily: fonts.heavy, fontSize: 15, color: colors.primary, minWidth: 30 }, tabular]}>{it.quantity}×</Text>
              <Text style={[text.body, { flex: 1, color: colors.ink }]}>{it.itemName}</Text>
            </View>
          ))}
          <KeyValueList rows={[{ label: 'Tổng tiền', value: formatVnd(handedOver.totalAmount), emphasis: true }, handedOver.completedAt ? { label: 'Giao lúc', value: formatOrderDate(handedOver.completedAt) } : null]} />
        </Card>
        <Button label="Xem chi tiết đơn" variant="secondary" onPress={() => router.push(`/vendor/orders/${handedOver.orderId}` as Href)} />
        {tally > 1 ? <Text style={[text.footnote, { color: colors.muted, textAlign: 'center' }]}>Đã giao {tally} đơn trong lần quét này</Text> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Quét mã nhận hàng' }} />
      {!online ? <Banner tone="warning">Mất kết nối. Mã cần được kiểm với máy chủ, chưa giao được.</Banner> : null}
      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Cách 1 · Quét mã QR trên máy khách</Text>
      {!permission ? (
        <ListSkeleton rows={1} height={300} />
      ) : !permission.granted ? (
        <View style={{ padding: 20, gap: 12, alignItems: 'center', borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
          <Icon sf="camera.fill" md="photo_camera" size={32} color={colors.primary} />
          <Text style={[text.callout, { color: colors.ink, textAlign: 'center' }]}>Cho phép dùng camera để quét mã nhận hàng của khách.</Text>
          {permission.canAskAgain ? (
            <Button label="Cho phép camera" onPress={() => void requestPermission()} />
          ) : (
            <Button label="Mở Cài đặt" variant="secondary" onPress={() => void Linking.openSettings()} />
          )}
        </View>
      ) : (
        <View style={{ height: 320, borderRadius: radius.pass, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#0B0F14' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={paused ? undefined : onScanned} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 210, height: 210, borderRadius: 24, borderWidth: 3, borderColor: handOver.isError ? colors.danger : handOver.isPending ? colors.mango : colors.white }} />
          </View>
          <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(17,28,43,0.72)' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.white }}>
                {handOver.isPending ? 'Đang kiểm tra mã…' : 'Đưa mã QR của khách vào khung'}
              </Text>
            </View>
          </View>
        </View>
      )}
      {handOver.isError && handOver.variables?.token ? (
        <Banner tone="danger" title="Không giao được" action={{ label: 'Quét lại', onPress: reset }}>
          {errorMessage(handOver.error)}
        </Banner>
      ) : null}

      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink, marginTop: 4 }}>Cách 2 · Nhập mã khách đọc</Text>
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
      <Banner tone="neutral" title="Khách không có mã?">Mở đơn trong bảng bếp và chọn “Khách không có mã?”. Lý do được ghi vào lịch sử đơn.</Banner>
    </Screen>
  );
}

const PRESETS: { kind: RangePreset; label: string }[] = [
  { kind: 'week', label: '7 ngày' },
  { kind: 'month30', label: '30 ngày' },
  { kind: 'thisMonth', label: 'Tháng này' },
  { kind: 'lastMonth', label: 'Tháng trước' },
];

/** V37 Doanh thu (ORD-07): completed orders only, by day/week/month, with the best bucket and refunds. */
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
    <Screen onRefresh={() => void summary.refetch()} refreshing={summary.isRefetching}>
      <Stack.Screen options={{ title: 'Doanh thu' }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {PRESETS.map((p) => (
          <Chip key={p.kind} label={p.label} selected={preset === p.kind} onPress={() => setPreset(p.kind)} accessibilityRole="radio" />
        ))}
      </ScrollView>
      <Segments<SalesGroup>
        value={groupBy}
        onChange={setGroupBy}
        options={[
          { key: 'day', label: 'Theo ngày' },
          { key: 'week', label: 'Theo tuần' },
          { key: 'month', label: 'Theo tháng' },
        ]}
      />
      {summary.isPending ? (
        <ListSkeleton rows={2} height={140} />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <>
          <View style={{ padding: 20, gap: 6, borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.brandTint }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>Doanh thu thực nhận</Text>
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 34, lineHeight: 40, color: colors.ink }, tabular]} adjustsFontSizeToFit numberOfLines={1}>{formatVnd(summary.data.netSales)}</Text>
            <Text style={[text.footnote, { color: colors.ink }]}>
              {summary.data.completedOrderCount} đơn hoàn thành · {activeDays(summary.data.buckets)} {groupBy === 'day' ? 'ngày' : groupBy === 'week' ? 'tuần' : 'tháng'} có bán
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Mini label="Tổng bán" value={formatVnd(summary.data.grossSales)} />
            <Mini label="Hoàn tiền" value={formatVnd(summary.data.refundedAmount)} note={rate != null ? `${rate.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` : undefined} />
          </View>
          {buckets.length === 0 || summary.data.completedOrderCount === 0 ? (
            <StateView icon={{ sf: 'chart.bar', md: 'bar_chart' }} tone="neutral" title="Chưa có đơn hoàn thành" body="Doanh thu chỉ tính đơn đã giao tận tay khách trong khoảng này." />
          ) : (
            <Card style={{ gap: 12 }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Theo {groupBy === 'day' ? 'ngày' : groupBy === 'week' ? 'tuần' : 'tháng'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'flex-end', height: 170 }}>
                {buckets.map((b) => {
                  const isBest = best?.key === b.key;
                  return (
                    <View key={b.key} accessible accessibilityLabel={`${bucketLabel(b.key)}: ${formatVnd(b.netSales)}, ${b.completedOrderCount} đơn`} style={{ width: 30, alignItems: 'center', gap: 4 }}>
                      {b.netSales > 0 ? <Text style={[{ fontFamily: fonts.semibold, fontSize: 9.5, color: isBest ? colors.primary : colors.muted }, tabular]}>{formatShortMoney(b.netSales)}</Text> : null}
                      <View style={{ width: 22, height: Math.max(4, (b.netSales / max) * 120), borderRadius: 6, backgroundColor: isBest ? colors.cta : b.netSales > 0 ? colors.brandLight : colors.sunken }} />
                      <Text style={[{ fontFamily: fonts.medium, fontSize: 9.5, color: colors.muted }, tabular]}>{shortKey(b.key)}</Text>
                    </View>
                  );
                })}
              </ScrollView>
              {best ? (
                <Text style={[text.footnote, { color: colors.ink }]}>
                  Bán tốt nhất: <Text style={{ fontFamily: fonts.bold }}>{bucketLabel(best.key)}</Text> · {formatVnd(best.netSales)} ({best.completedOrderCount} đơn)
                </Text>
              ) : null}
            </Card>
          )}
          <Pressable onPress={() => router.navigate('/vendor/finance' as Href)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Phí thuê ô và tiền phạt ở Tài chính</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function Mini({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={{ flex: 1, padding: 14, gap: 3, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
      <Text style={[text.caption, { color: colors.muted }]}>{label}</Text>
      <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }, tabular]} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      {note ? <Text style={[text.caption, { color: colors.muted }]}>{note}</Text> : null}
    </View>
  );
}

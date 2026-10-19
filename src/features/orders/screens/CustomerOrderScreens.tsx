import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Modal, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { PermitQr } from '@/components/common/PermitQr';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { commerceApi, errorMessage } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { directionsUrl } from '@/features/buyer-discovery/discovery-format';
import { detectPosition } from '@/features/buyer-discovery/geolocation';
import { useNow } from '@/features/sidewalk-slots/useNow';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVnd } from '@/utils/format';
import { orderApi } from '../api/orderApi';
import { haversineMeters, walkingMinutes } from '../pickup/pickup-range';
import { dayHeading, orderItemsSummary, providerName, refundPresentation, useOnline, vietnamDayKey } from '../components/order-display';
import { formatOrderDate, formatOrderTime } from '../components/order-format';
import { useAnnounceArrival, useOrderTracking } from '../hooks/useOrderTracking';
import { useCustomerOrder, useCustomerOrders, useRefreshAfterOrderMutation } from '../hooks/useOrders';
import { buildTrackingSteps, hasTrackingJourney, TRACKING_HEADLINES, trackingProgress } from '../tracking/tracking-steps';
import { useReadyNotice } from '../tracking/useReadyNotice';
import { COLLECTABLE_ORDER_STATUSES, TERMINAL_ORDER_STATUSES, type Order, type OrderStatus } from '../types/order.types';

const go = (href: string) => router.push(href as Href);
type Tab = 'ALL' | 'PENDING_PAYMENT' | 'PLACED' | 'PROCESSING' | 'READY_FOR_PICKUP' | 'COMPLETED' | 'CLOSED';
const TABS: { value: Tab; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PENDING_PAYMENT', label: 'Chờ thanh toán' },
  { value: 'PLACED', label: 'Đã đặt' },
  { value: 'PROCESSING', label: 'Đang làm' },
  { value: 'READY_FOR_PICKUP', label: 'Sẵn sàng nhận' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CLOSED', label: 'Huỷ / từ chối' },
];
const TAB_STATUSES: Record<Tab, OrderStatus | readonly OrderStatus[] | undefined> = {
  ALL: undefined,
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PLACED: 'PLACED',
  PROCESSING: ['ACCEPTED', 'PREPARING'],
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  COMPLETED: 'COMPLETED',
  CLOSED: ['CANCELLED', 'REJECTED'],
};
const PAGE_SIZE = 10;

/** V-C11 Đơn hàng: the order in motion on top, the rest by day; filter by stage. */
export function CustomerOrdersScreen() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('ALL');
  const [page, setPage] = useState(1);
  const orders = useCustomerOrders({ status: TAB_STATUSES[tab], page, pageSize: PAGE_SIZE }, user?.role_code === 'CUSTOMER');
  const totalPages = orders.data?.totalPages ?? 0;
  if (totalPages > 0 && page > totalPages) setPage(totalPages);

  if (user?.role_code !== 'CUSTOMER') {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Đơn hàng' }} />
        <StateView icon={{ sf: 'bag', md: 'receipt_long' }} title="Đăng nhập để xem đơn hàng" body="Đơn đặt trước và mã nhận món nằm ở đây." action={{ label: 'Đăng nhập', onPress: () => go('/auth/sign-in') }} />
      </Screen>
    );
  }
  const items = orders.data?.items ?? [];
  const rows: ({ kind: 'day'; key: string; label: string } | { kind: 'order'; key: string; order: Order })[] = [];
  let lastDay = '';
  for (const o of items) {
    const day = vietnamDayKey(o.placedAt ?? o.createdAt);
    if (day !== lastDay) {
      rows.push({ kind: 'day', key: `d-${day}`, label: dayHeading(day) });
      lastDay = day;
    }
    rows.push({ kind: 'order', key: String(o.orderId), order: o });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Đơn hàng của tôi' }} />
      <FlatList
        data={orders.isPending ? [] : rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={orders.isRefetching && !orders.isPending} onRefresh={() => void orders.refetch()} tintColor={colors.cta} colors={[colors.cta]} />}
        ListHeaderComponent={
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16, marginBottom: 4 }}>
            {TABS.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                selected={tab === t.value}
                onPress={() => {
                  setTab(t.value);
                  setPage(1);
                }}
                accessibilityRole="radio"
              />
            ))}
          </ScrollView>
        }
        renderItem={({ item }) =>
          item.kind === 'day' ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.muted, marginTop: 6 }}>{item.label.toUpperCase()}</Text>
          ) : (
            <OrderRow order={item.order} />
          )
        }
        ListEmptyComponent={
          orders.isPending ? (
            <ListSkeleton rows={3} height={110} />
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
          ) : (
            <StateView icon={{ sf: 'bag', md: 'shopping_bag' }} title={tab === 'ALL' ? 'Chưa có đơn nào' : 'Không có đơn trong mục này'} body="Đặt trước món ở Khám phá, đến quầy chỉ việc lấy." action={tab === 'ALL' ? { label: 'Khám phá món', onPress: () => router.navigate('/customer/explore' as Href) } : undefined} />
          )
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 8 }}>
              <Button label="Trước" variant="secondary" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} style={{ paddingHorizontal: 18 }} />
              <Text style={[text.footnote, { color: colors.ink }, tabular]}>Trang {page}/{totalPages}</Text>
              <Button label="Sau" variant="secondary" disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)} style={{ paddingHorizontal: 18 }} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

function OrderRow({ order }: { order: Order }) {
  const s = statusLabel(order.orderStatus);
  const live = !TERMINAL_ORDER_STATUSES.has(order.orderStatus);
  const ready = order.orderStatus === 'READY_FOR_PICKUP';
  const unpaid = order.orderStatus === 'PENDING_PAYMENT';
  return (
    <Pressable
      onPress={() => go(unpaid ? `/customer/orders/${order.orderId}/payment` : `/customer/orders/${order.orderId}`)}
      accessibilityRole="button"
      accessibilityLabel={`Đơn ${order.orderCode} tại ${order.storefront.storefrontName}, ${s.label}`}
      style={({ pressed }) => ({ padding: 14, gap: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card, borderWidth: ready ? 2 : unpaid ? 1.5 : 0, borderColor: ready ? colors.leaf : colors.mango })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: live ? colors.brandTint : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf={ready ? 'bell.fill' : live ? 'flame.fill' : 'bag.fill'} md={ready ? 'notifications_active' : live ? 'local_fire_department' : 'shopping_bag'} size={18} color={live ? colors.primary : colors.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.headline, { color: colors.ink }]} numberOfLines={1}>{order.storefront.storefrontName}</Text>
          <Text style={[text.caption, { color: colors.muted }, tabular]}>#{order.orderCode} · {formatOrderTime(order.placedAt ?? order.createdAt)}</Text>
        </View>
        <StatusPill label={s.label} tone={s.tone} />
      </View>
      <Text style={[text.footnote, { color: colors.ink }]} numberOfLines={2}>{orderItemsSummary(order)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[text.caption, { color: ready ? colors.onLeaf : unpaid ? colors.onMango : colors.muted, fontFamily: fonts.semibold }]}>
          {ready ? 'Mời bạn đến quầy lấy món' : unpaid ? 'Chưa thanh toán · chạm để tiếp tục' : live ? TRACKING_HEADLINES[order.orderStatus] : ''}
        </Text>
        <Text style={[{ fontFamily: fonts.heavy, fontSize: 15, color: colors.ink }, tabular]}>{formatVnd(order.totalAmount)}</Text>
      </View>
    </Pressable>
  );
}

/** The pickup code: the signed QR the stall scans, and the short code to read out. Never cached. */
function PickupCode({ order }: { order: Order }) {
  const { width } = useWindowDimensions();
  const [full, setFull] = useState(false);
  const code = useQuery({ queryKey: ['orders', 'customer', 'pickup-code', order.orderId, order.orderStatus], queryFn: () => orderApi.pickupCode(order.orderId), staleTime: 0, gcTime: 0 });
  const size = Math.min(220, width - 120);
  if (code.isPending) return <ListSkeleton rows={1} height={size + 80} />;
  if (code.isError) return <ErrorState title="Chưa lấy được mã nhận món" error={code.error} onRetry={() => void code.refetch()} />;
  return (
    <View style={{ alignItems: 'center', gap: 10, padding: 18, borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.muted }}>MÃ NHẬN MÓN</Text>
      <Pressable onPress={() => setFull(true)} accessibilityRole="button" accessibilityLabel="Phóng to mã nhận món" style={{ padding: 12, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }}>
        <PermitQr value={code.data.token} size={size} />
      </Pressable>
      <Text selectable style={[{ fontFamily: fonts.code, fontSize: 26, letterSpacing: 4, color: colors.ink }, tabular]}>{code.data.shortCode}</Text>
      <Text style={[text.footnote, { color: colors.muted, textAlign: 'center' }]}>Đưa mã này cho quán quét khi lấy món. Không quét được thì đọc mã chữ.</Text>
      <Button label="Phóng to mã" variant="secondary" icon={{ sf: 'arrow.up.left.and.arrow.down.right', md: 'open_in_full' }} onPress={() => setFull(true)} />
      {full ? <FullCode token={code.data.token} shortCode={code.data.shortCode} onClose={() => setFull(false)} /> : null}
    </View>
  );
}

/** Full screen, full brightness, screen kept on: the counter's scanner reads it first time. */
function FullCode({ token, shortCode, onClose }: { token: string; shortCode: string; onClose: () => void }) {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    let previous: number | null = null;
    void Brightness.getBrightnessAsync()
      .then((b) => {
        previous = b;
        return Brightness.setBrightnessAsync(1);
      })
      .catch(() => undefined);
    return () => {
      if (previous != null) void Brightness.setBrightnessAsync(previous).catch(() => undefined);
    };
  }, []);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: insets.top }}>
        <PermitQr value={token} size={Math.min(width - 48, 360)} />
        <Text style={[{ fontFamily: fonts.code, fontSize: 34, letterSpacing: 6, color: colors.ink }, tabular]}>{shortCode}</Text>
        <Button label="Đóng" variant="secondary" onPress={onClose} style={{ paddingHorizontal: 28 }} />
      </View>
    </Modal>
  );
}

/** V-C12 Chi tiết đơn: where it is, the pickup code, where to collect, the receipt, and what you can do. */
export function CustomerOrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const online = useOnline();
  const order = useCustomerOrder(orderId);
  const tracking = useOrderTracking(order.data?.orderId, order.data?.orderStatus);
  useReadyNotice(order.data?.orderStatus);
  const refresh = useRefreshAfterOrderMutation('customer', Number(orderId));
  const announce = useAnnounceArrival(order.data?.orderId);
  const [locatingEta, setLocatingEta] = useState(false);
  const arrivalNow = useNow(15_000);
  const cancel = useMutation({
    mutationFn: () => orderApi.cancel(order.data!.orderId),
    onSuccess: async (next) => {
      await refresh.update(next);
      showToast('Đã huỷ đơn; yêu cầu hoàn tiền đang được xử lý nếu đã thanh toán');
    },
    onError: async (e) => {
      await refresh.handleError(e);
      showToast(errorMessage(e), 'error');
    },
  });

  if (order.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Đơn hàng' }} />
        <ListSkeleton rows={1} height={300} />
      </Screen>
    );
  }
  if (order.isError || !order.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Đơn hàng' }} />
        <ErrorState error={order.error ?? new Error('Không tìm thấy đơn.')} onRetry={() => void order.refetch()} />
      </Screen>
    );
  }
  const d = order.data;
  const pending = d.orderStatus === 'PENDING_PAYMENT';
  const collectable = COLLECTABLE_ORDER_STATUSES.has(d.orderStatus);
  const canCancel = d.orderStatus === 'PLACED';
  const canComplain = d.paymentStatus === 'SUCCESS' && !['PENDING_PAYMENT', 'PLACED'].includes(d.orderStatus);
  const canReview = d.orderStatus === 'COMPLETED';
  const refund = d.refundStatus ? refundPresentation(d.refundStatus) : null;
  const steps = hasTrackingJourney(d.orderStatus) ? buildTrackingSteps(d.orderStatus, d.statusHistory) : [];
  const progress = trackingProgress(steps);
  const t = tracking.data;
  const point = t?.pickupPoint;
  // At most 3 notices an order (the server refuses more), one every 2 minutes, none once the stall has seen it.
  const sentAt = announce.data?.notifiedAt ?? t?.arrivalNotifiedAt ?? null;
  const canAnnounce =
    (!sentAt || arrivalNow - Date.parse(sentAt) >= 2 * 60_000) && (t?.arrivalNoticeCount ?? 0) < 3 && !t?.arrivalAcknowledgedAt;
  const est = t?.readyEstimate;

  return (
    <Screen onRefresh={() => void Promise.all([order.refetch(), tracking.refetch()])} refreshing={order.isRefetching}>
      <Stack.Screen options={{ title: `#${d.orderCode}` }} />
      {!online ? <Banner tone="warning">Mất kết nối. Trạng thái đơn có thể chưa mới.</Banner> : null}
      {pending ? (
        <Banner tone="warning" title="Đang chờ xác nhận thanh toán" action={{ label: 'Kiểm tra thanh toán', onPress: () => go(`/customer/orders/${d.orderId}/payment`) }}>
          Trạng thái chỉ đổi khi máy chủ nhận xác nhận hợp lệ từ ví.
        </Banner>
      ) : null}

      {steps.length ? (
        <Card style={{ gap: 14 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, color: colors.ink }}>{TRACKING_HEADLINES[d.orderStatus]}</Text>
          {est && (d.orderStatus === 'PLACED' || d.orderStatus === 'ACCEPTED' || d.orderStatus === 'PREPARING') ? (
            <Text style={[text.footnote, { color: est.isLate ? colors.onDanger : colors.ink }]}>
              {est.isLate ? 'Đơn đang lâu hơn thường lệ. ' : ''}
              {est.earliestReadyAt && est.latestReadyAt ? `Dự kiến xong khoảng ${formatOrderTime(est.earliestReadyAt)}–${formatOrderTime(est.latestReadyAt)}` : `Thường mất ${est.lowMinutes}–${est.highMinutes} phút`}
              {t && t.ordersAhead > 0 ? ` · ${t.ordersAhead} đơn trước bạn` : ''}
            </Text>
          ) : null}
          <View>
            <View style={{ position: 'absolute', left: 14, right: 14, top: 13, height: 4, borderRadius: 2, backgroundColor: colors.sunken }}>
              <View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 2, backgroundColor: d.orderStatus === 'CANCELLED' || d.orderStatus === 'REJECTED' ? colors.danger : colors.leaf }} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              {steps.map((s) => {
                const bg = s.state === 'done' ? colors.leaf : s.state === 'current' ? colors.cta : s.state === 'stopped' ? colors.danger : colors.sunken;
                return (
                  <View key={s.status} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: bg, borderWidth: 3, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                      {s.state === 'done' ? <Icon sf="checkmark" md="check" size={12} color={colors.white} weight="bold" /> : s.state === 'stopped' ? <Icon sf="xmark" md="close" size={12} color={colors.white} weight="bold" /> : s.state === 'current' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white }} /> : null}
                    </View>
                    <Text style={[text.caption, { color: s.state === 'upcoming' ? colors.muted : colors.ink, textAlign: 'center' }]}>{s.label}</Text>
                    {s.reachedAt ? <Text style={[{ fontFamily: fonts.medium, fontSize: 10.5, color: colors.muted }, tabular]}>{formatOrderTime(s.reachedAt)}</Text> : null}
                  </View>
                );
              })}
            </View>
          </View>
        </Card>
      ) : null}

      {collectable ? <PickupCode order={d} /> : null}

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="mappin.and.ellipse" md="location_on" size={19} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.caption, { color: colors.muted }]}>Lấy món tại</Text>
            <Text style={[text.subhead, { color: colors.ink }]}>{d.storefront.storefrontName}</Text>
            {point?.address || d.storefront.address ? <Text style={[text.caption, { color: colors.muted }]}>{point?.address ?? d.storefront.address}</Text> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {point ? <Button label="Chỉ đường" variant="secondary" icon={{ sf: 'arrow.triangle.turn.up.right.diamond.fill', md: 'directions' }} onPress={() => void Linking.openURL(directionsUrl(point.latitude, point.longitude))} style={{ flex: 1 }} /> : null}
          {collectable ? (
            <Button
              label={t?.arrivalAcknowledgedAt ? 'Quán đã thấy' : sentAt ? 'Báo lại' : 'Tôi đang đến'}
              variant="sign"
              icon={{ sf: 'figure.walk', md: 'directions_walk' }}
              loading={announce.isPending || locatingEta}
              disabled={!canAnnounce || announce.isPending || locatingEta}
              onPress={async () => {
                // With the buyer's position, the stall gets a walking ETA (as on the web); without it, none.
                setLocatingEta(true);
                let etaMinutes: number | undefined;
                try {
                  if (point) etaMinutes = walkingMinutes(haversineMeters(point, await detectPosition()));
                } catch {
                  etaMinutes = undefined;
                } finally {
                  setLocatingEta(false);
                }
                announce.mutate(etaMinutes, {
                  onSuccess: (notice) => showToast(notice.alreadySent ? 'Quán đã nhận được thông báo của bạn.' : 'Đã báo quán bạn đang đến.'),
                  onError: (e) => showToast(errorMessage(e), 'error'),
                });
              }}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
        {t?.arrivalNotifiedAt ? <Text style={[text.caption, { color: colors.sign }]}>Đã báo quán lúc {formatOrderTime(t.arrivalNotifiedAt)}{t.arrivalAcknowledgedAt ? ` · quán đã thấy lúc ${formatOrderTime(t.arrivalAcknowledgedAt)}` : ''}</Text> : null}
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Hoá đơn</Text>
          <StatusPill label={statusLabel(d.orderStatus).label} tone={statusLabel(d.orderStatus).tone} />
        </View>
        {d.items.map((i) => (
          <View key={i.orderItemId} style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 15, color: colors.primary, minWidth: 30 }, tabular]}>{i.quantity}×</Text>
            <View style={{ flex: 1 }}>
              <Text style={[text.callout, { color: colors.ink }]}>{i.itemName}</Text>
              {i.note ? <Text style={[text.caption, { color: colors.onMango }]}>Ghi chú: {i.note}</Text> : null}
            </View>
            <Text style={[text.callout, { color: colors.ink }, tabular]}>{formatVnd(i.lineTotal)}</Text>
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: colors.separator }} />
        <KeyValueList
          rows={[
            { label: 'Tổng tiền', value: formatVnd(d.totalAmount), emphasis: true },
            { label: 'Thanh toán', value: providerName(d.paymentProvider) ?? 'Chưa chọn ví' },
            d.paymentStatus ? { label: 'Trạng thái thanh toán', value: statusLabel(d.paymentStatus).label } : null,
            d.placedAt ? { label: 'Đặt lúc', value: formatOrderDate(d.placedAt) } : null,
            d.completedAt ? { label: 'Nhận lúc', value: formatOrderDate(d.completedAt) } : null,
          ]}
        />
      </Card>

      {d.rejectionReason ? <Banner tone="danger" title="Lý do quán từ chối">{d.rejectionReason}</Banner> : null}
      {refund ? (
        <Banner tone={refund.tone === 'ok' ? 'success' : refund.tone === 'danger' ? 'danger' : 'warning'} title={`${refund.label}${d.refundAmount ? ` · ${formatVnd(d.refundAmount)}` : ''}`}>
          {refund.message}
        </Banner>
      ) : null}

      {canReview || canComplain ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {canReview ? <Button label="Đánh giá" icon={{ sf: 'star.fill', md: 'star' }} onPress={() => go(`/customer/orders/${d.orderId}/review`)} style={{ flex: 1 }} /> : null}
          {canComplain ? <Button label="Khiếu nại" variant="secondary" icon={{ sf: 'exclamationmark.bubble', md: 'feedback' }} onPress={() => go(`/customer/orders/${d.orderId}/complaint`)} style={{ flex: 1 }} /> : null}
        </View>
      ) : null}
      {canCancel ? (
        <Pressable
          onPress={() =>
            Alert.alert('Huỷ đơn hàng?', 'Chỉ đơn quán chưa nhận mới huỷ được. Nếu đã thanh toán, hệ thống tạo yêu cầu hoàn tiền.', [
              { text: 'Giữ đơn', style: 'cancel' },
              { text: 'Huỷ đơn', style: 'destructive', onPress: () => cancel.mutate() },
            ])
          }
          disabled={cancel.isPending}
          accessibilityRole="button"
          style={{ alignSelf: 'center', padding: 10 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.onDanger }}>{cancel.isPending ? 'Đang huỷ…' : 'Huỷ đơn'}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const RATING_WORDS = ['Chưa ổn', 'Tạm được', 'Được', 'Ngon', 'Tuyệt vời'];
const MAX_REVIEW = 1000;

/** V-C13 Đánh giá đơn: stars, a word for them, a note; editable later. Only for a completed order. */
export function OrderReviewScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const cache = useQueryClient();
  const order = useCustomerOrder(orderId);
  const review = useQuery({ queryKey: ['commerce', 'review', orderId], queryFn: () => commerceApi.review(orderId!), enabled: Boolean(orderId) });
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const current = rating ?? review.data?.rating ?? 5;
  const currentNote = note ?? review.data?.text ?? '';
  const save = useMutation({
    mutationFn: () => commerceApi.saveReview(Number(orderId), current, currentNote.trim()),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['commerce', 'review', orderId] });
      await cache.invalidateQueries({ queryKey: ['commerce', 'storefront'] });
      showToast('Cảm ơn bạn đã đánh giá');
      router.back();
    },
  });

  if (order.isPending || review.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Đánh giá' }} />
        <ListSkeleton rows={2} height={120} />
      </Screen>
    );
  }
  if (order.isError || !order.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Đánh giá' }} />
        <ErrorState error={order.error} onRetry={() => void order.refetch()} />
      </Screen>
    );
  }
  const completed = order.data.orderStatus === 'COMPLETED';
  return (
    <Screen footer={completed ? <Button label="Lưu đánh giá" size={56} loading={save.isPending} onPress={() => save.mutate()} /> : undefined}>
      <Stack.Screen options={{ title: 'Đánh giá' }} />
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
        <Text style={[text.caption, { color: colors.muted }]}>#{order.data.orderCode}</Text>
        <Text style={[text.title2, { color: colors.ink, textAlign: 'center', fontFamily: fonts.heavy }]}>Món ở {order.data.storefront.storefrontName} thế nào?</Text>
      </View>
      {!completed ? (
        <Banner tone="neutral">Chỉ đánh giá được đơn đã hoàn tất.</Banner>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }} accessibilityRole="adjustable" accessibilityValue={{ min: 1, max: 5, now: current }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${n} sao`}>
                <Icon sf={n <= current ? 'star.fill' : 'star'} md="star" size={42} color={n <= current ? colors.mango : colors.line} />
              </Pressable>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.onMango, textAlign: 'center' }}>{RATING_WORDS[current - 1]}</Text>
          <TextField label="Nhận xét" optional value={currentNote} onChangeText={setNote} multiline maxLength={MAX_REVIEW} placeholder="Món, phần ăn, cách phục vụ" hint={`${review.data ? 'Đang sửa đánh giá cũ. ' : ''}${currentNote.length}/${MAX_REVIEW} ký tự`} />
          {save.isError ? <Banner tone="danger">{errorMessage(save.error)}</Banner> : null}
        </>
      )}
    </Screen>
  );
}

const COMPLAINT_TYPES = [
  { value: 'COMPLAINT', label: 'Khiếu nại', note: 'Báo món sai, thiếu, hoặc chất lượng không như mô tả.' },
  { value: 'REFUND_REQUEST', label: 'Yêu cầu hoàn tiền', note: 'Xin hoàn lại một phần hoặc toàn bộ số tiền đã trả cho đơn.' },
] as const;

/** V-C14 Khiếu nại đơn: a complaint or a refund request, sent to the platform team. One open at a time. */
export function OrderComplaintScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const cache = useQueryClient();
  const order = useCustomerOrder(orderId);
  const complaints = useQuery({ queryKey: ['commerce', 'complaints', orderId], queryFn: () => commerceApi.complaints(orderId!), enabled: Boolean(orderId) });
  const [type, setType] = useState<(typeof COMPLAINT_TYPES)[number]['value']>('COMPLAINT');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string>();
  const submit = useMutation({
    mutationFn: () => commerceApi.complain(Number(orderId), { complaintType: type, description: description.trim(), requestedRefundAmount: type === 'REFUND_REQUEST' ? Number(amount) : null }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['commerce', 'complaints', orderId] });
      showToast('Đã gửi khiếu nại tới quản trị viên');
      router.back();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (order.isPending || complaints.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Khiếu nại' }} />
        <ListSkeleton rows={3} height={80} />
      </Screen>
    );
  }
  if (order.isError || complaints.isError || !order.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Khiếu nại' }} />
        <ErrorState error={order.error ?? complaints.error} onRetry={() => void Promise.all([order.refetch(), complaints.refetch()])} />
      </Screen>
    );
  }
  const d = order.data;
  const open = complaints.data.some((c) => c.status === 'OPEN' || c.status === 'UNDER_REVIEW');
  const eligible = d.paymentStatus === 'SUCCESS' && !['PENDING_PAYMENT', 'PLACED'].includes(d.orderStatus);
  const send = () => {
    setError(undefined);
    if (!description.trim()) return setError('Mô tả vấn đề bạn gặp: món nào, vấn đề gì, lúc mấy giờ.');
    if (type === 'REFUND_REQUEST') {
      const n = Number(amount);
      if (!Number.isSafeInteger(n) || n <= 0 || n > d.totalAmount) return setError(`Số tiền hoàn từ 1 đến ${formatVnd(d.totalAmount)}.`);
    }
    submit.mutate();
  };

  return (
    <Screen footer={eligible && !open ? <Button label="Gửi khiếu nại" size={56} loading={submit.isPending} onPress={send} /> : undefined}>
      <Stack.Screen options={{ title: 'Khiếu nại' }} />
      <Card style={{ gap: 4 }}>
        <Text style={[text.caption, { color: colors.muted }]}>#{d.orderCode} · {d.storefront.storefrontName}</Text>
        <Text style={[{ fontFamily: fonts.heavy, fontSize: 18, color: colors.ink }, tabular]}>{formatVnd(d.totalAmount)}</Text>
      </Card>
      {complaints.data.map((c) => (
        <Card key={c.complaintId} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[text.subhead, { color: colors.ink }]}>{c.complaintType === 'REFUND_REQUEST' ? 'Yêu cầu hoàn tiền' : 'Khiếu nại'}</Text>
            <StatusPill label={statusLabel(c.status).label} tone={statusLabel(c.status).tone} />
          </View>
          <Text style={[text.footnote, { color: colors.ink }]}>{c.description}</Text>
          {c.requestedRefundAmount ? <Text style={[text.caption, { color: colors.muted }]}>Xin hoàn {formatVnd(c.requestedRefundAmount)}</Text> : null}
          {c.resolutionNotes ? <Text style={[text.caption, { color: colors.onLeaf }]}>Phản hồi: {c.resolutionNotes}</Text> : null}
          <Text style={[text.caption, { color: colors.muted }]}>Gửi {formatOrderDate(c.createdAt)}</Text>
        </Card>
      ))}
      {!eligible ? (
        <Banner tone="neutral">Khiếu nại mở khi đơn đã thanh toán và quán đã nhận đơn.</Banner>
      ) : open ? (
        <Banner tone="info">Bạn đã có một khiếu nại đang được xem xét cho đơn này.</Banner>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            {COMPLAINT_TYPES.map((c) => {
              const on = type === c.value;
              return (
                <Pressable key={c.value} onPress={() => setType(c.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: on ? colors.kerbPaint : colors.card, borderWidth: on ? 2 : 1, borderColor: on ? colors.cta : colors.line }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.subhead, { color: colors.ink }]}>{c.label}</Text>
                    <Text style={[text.caption, { color: colors.muted }]}>{c.note}</Text>
                  </View>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 7 : 2, borderColor: on ? colors.cta : colors.line }} />
                </Pressable>
              );
            })}
          </View>
          <TextField label="Mô tả chi tiết" value={description} onChangeText={setDescription} multiline placeholder="Món nào, vấn đề gì, lúc mấy giờ" maxLength={1000} />
          {type === 'REFUND_REQUEST' ? (
            <TextField label="Số tiền xin hoàn" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" hint={`Tối đa ${formatVnd(d.totalAmount)}`} trailing={<Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>đ</Text>} />
          ) : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Text style={[text.caption, { color: colors.muted }]}>Đội vận hành nền tảng xem xét và trả lời. Hoàn tiền (nếu được duyệt) trả về ví đã dùng.</Text>
        </>
      )}
    </Screen>
  );
}

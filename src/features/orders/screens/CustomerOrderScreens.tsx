import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Brightness from 'expo-brightness';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Modal, Pressable, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Blocks';
import { Icon } from '@/components/common/Icon';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { PermitQr } from '@/components/common/PermitQr';
import { Sheet } from '@/components/common/Sheet';
import { SheetOption } from '@/components/common/SheetOption';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { MoreButton } from '@/components/native/ActionMenu';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StatusPill } from '@/components/status/StatusPill';
import { commerceApi, errorMessage } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { directionsUrl } from '@/features/buyer-discovery/discovery-format';
import { storefrontPhotos } from '@/features/buyer-discovery/food-photos';
import { detectPosition } from '@/features/buyer-discovery/geolocation';
import { useNow } from '@/features/sidewalk-slots/useNow';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Pass } from '@/ui';
import { formatVnd } from '@/utils/format';
import { orderApi } from '../api/orderApi';
import { haversineMeters, walkingMinutes } from '../pickup/pickup-range';
import { dayHeading, orderItemsSummary, providerName, refundPresentation, useOnline, vietnamDayKey } from '../components/order-display';
import { formatOrderDate, formatOrderTime } from '../components/order-format';
import { useAnnounceArrival, useOrderTracking } from '../hooks/useOrderTracking';
import { useCustomerOrder, useCustomerOrders, useRefreshAfterOrderMutation } from '../hooks/useOrders';
import { buildTrackingSteps, TRACKING_HEADLINES, trackingProgress } from '../tracking/tracking-steps';
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
const TAB_ICONS: Record<Tab, { sf: string; md: string }> = {
  ALL: { sf: 'square.stack.fill', md: 'receipt_long' },
  PENDING_PAYMENT: { sf: 'creditcard.fill', md: 'credit_card' },
  PLACED: { sf: 'paperplane.fill', md: 'send' },
  PROCESSING: { sf: 'flame.fill', md: 'local_fire_department' },
  READY_FOR_PICKUP: { sf: 'bell.fill', md: 'notifications_active' },
  COMPLETED: { sf: 'checkmark.circle.fill', md: 'check_circle' },
  CLOSED: { sf: 'xmark.circle.fill', md: 'cancel' },
};

/**
 * V-C11 Đơn hàng, v5 (screens/v5/buyer-rest.md): the large native title, one filter capsule
 * that opens a sheet of stages (instead of a web strip of seven chips), then the orders by
 * Vietnamese day as photo rows: the stall's photo, what was ordered, the code and total in
 * sign figures; a ready order ringed in green, an unpaid one in mango.
 */
export function CustomerOrdersScreen() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
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

  const current = TABS.find((t) => t.value === tab) ?? TABS[0]!;
  const filtered = tab !== 'ALL';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Đơn hàng của tôi', headerLargeTitleEnabled: true }} />
      <FlatList
        data={orders.isPending ? [] : rows}
        keyExtractor={(r) => r.key}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={orders.isRefetching && !orders.isPending} onRefresh={() => void orders.refetch()} tintColor={colors.cta} colors={[colors.cta]} />}
        ListHeaderComponent={
          <Pressable
            onPress={() => setFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Lọc đơn: ${current.label}. Chạm để đổi`}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 44,
              paddingLeft: 14,
              paddingRight: 16,
              marginBottom: 4,
              borderRadius: radius.full,
              backgroundColor: filtered ? colors.cta : pressed ? colors.brandTint : colors.card,
              borderWidth: filtered ? 0 : 1.5,
              borderColor: colors.line,
              boxShadow: filtered ? shadow.glow : undefined,
            })}
          >
            <Icon sf={TAB_ICONS[tab].sf} md={TAB_ICONS[tab].md} size={16} color={filtered ? colors.white : colors.primary} />
            <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: filtered ? colors.white : colors.ink }}>{current.label}</Text>
            <Icon sf="chevron.down" md="expand_more" size={13} color={filtered ? colors.white : colors.muted} weight="bold" />
          </Pressable>
        }
        renderItem={({ item }) =>
          item.kind === 'day' ? (
            <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 22, color: colors.ink, marginTop: 8 }}>{item.label}</Text>
          ) : (
            <OrderRow order={item.order} />
          )
        }
        ListEmptyComponent={
          orders.isPending ? (
            <OrderListSkeleton />
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
          ) : (
            <StateView
              icon={{ sf: 'bag', md: 'shopping_bag' }}
              title={tab === 'ALL' ? 'Chưa có đơn nào' : 'Không có đơn trong mục này'}
              body="Đặt trước món ở Khám phá, đến quầy chỉ việc lấy."
              action={
                tab === 'ALL'
                  ? { label: 'Khám phá món', onPress: () => router.navigate('/customer/explore' as Href) }
                  : {
                      label: 'Xem tất cả đơn',
                      onPress: () => {
                        setTab('ALL');
                        setPage(1);
                      },
                    }
              }
            />
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
      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Lọc đơn" subtitle="Chọn giai đoạn của đơn.">
        {TABS.map((t, i) => (
          <SheetOption
            key={t.value}
            title={t.label}
            icon={TAB_ICONS[t.value]}
            selected={tab === t.value}
            last={i === TABS.length - 1}
            onPress={() => {
              setTab(t.value);
              setPage(1);
              setFilterOpen(false);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

/** Same shapes as the photo rows. */
function OrderListSkeleton() {
  return (
    <View style={{ gap: 12 }} accessibilityLabel="Đang tải đơn hàng">
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
          <Skeleton width={68} height={68} radius={radius.photo} />
          <View style={{ flex: 1, gap: 8, justifyContent: 'center' }}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="85%" height={12} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The stall's own photo, else an illustrative one for its name; a bag glyph if both fail. */
function StorePhoto({ storefront, size, dim }: { storefront: Order['storefront']; size: number; dim?: boolean }) {
  const photos = useMemo(
    () => storefrontPhotos({ storefrontId: storefront.storefrontId, storefrontName: storefront.storefrontName, imageUrl: storefront.imageUrl }),
    [storefront.storefrontId, storefront.storefrontName, storefront.imageUrl],
  );
  const [failed, setFailed] = useState(0);
  const photo = photos[failed];
  return (
    <View style={{ width: size, height: size, borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
      {photo ? (
        <Image source={photo.source} style={{ width: '100%', height: '100%', opacity: dim ? 0.55 : 1 }} contentFit="cover" transition={150} onError={() => setFailed((n) => n + 1)} accessibilityIgnoresInvertColors />
      ) : (
        <Icon sf="bag.fill" md="shopping_bag" size={22} color={colors.primary} />
      )}
    </View>
  );
}

function OrderRow({ order }: { order: Order }) {
  const s = statusLabel(order.orderStatus);
  const live = !TERMINAL_ORDER_STATUSES.has(order.orderStatus);
  const ready = order.orderStatus === 'READY_FOR_PICKUP';
  const unpaid = order.orderStatus === 'PENDING_PAYMENT';
  const hint = ready ? 'Mời bạn đến quầy lấy món' : unpaid ? 'Chưa thanh toán, chạm để tiếp tục' : live ? TRACKING_HEADLINES[order.orderStatus] : '';
  return (
    <Pressable
      onPress={() => go(unpaid ? `/customer/orders/${order.orderId}/payment` : `/customer/orders/${order.orderId}`)}
      accessibilityRole="button"
      accessibilityLabel={`Đơn ${order.orderCode} tại ${order.storefront.storefrontName}, ${s.label}`}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.kerbPaint : colors.card, borderWidth: ready ? 2 : unpaid ? 1.5 : 0, borderColor: ready ? colors.leaf : colors.mango, boxShadow: shadow.card })}
    >
      <StorePhoto storefront={order.storefront} size={68} dim={order.orderStatus === 'CANCELLED' || order.orderStatus === 'REJECTED'} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 16, lineHeight: 21, color: colors.ink }} numberOfLines={1}>{order.storefront.storefrontName}</Text>
          <StatusPill label={s.label} tone={s.tone} />
        </View>
        <Text style={[text.footnote, { color: colors.ink }]} numberOfLines={2}>{orderItemsSummary(order)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
          <Text style={[text.caption, { flexShrink: 1, color: colors.muted }, tabular]} numberOfLines={1}>
            <Text style={{ fontFamily: fonts.code, fontSize: 13, color: colors.ink }}>#{order.orderCode}</Text>, {formatOrderTime(order.placedAt ?? order.createdAt)}
          </Text>
          <Text maxFontSizeMultiplier={1.4} style={[sign.price, { color: colors.ink }, tabular]}>{formatVnd(order.totalAmount)}</Text>
        </View>
        {hint ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: ready ? colors.leaf : unpaid ? colors.mango : colors.cta }} />
            <Text style={[text.caption, { flex: 1, color: ready ? colors.onLeaf : unpaid ? colors.onMango : colors.primary }]}>{hint}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The pickup code as a pass: the signed QR the stall scans and the short code to read out,
 * fetched fresh every time (never cached). Tapping it opens it full screen at full brightness.
 */
function PickupPass({ order, open, setOpen }: { order: Order; open: boolean; setOpen: (v: boolean) => void }) {
  const { width } = useWindowDimensions();
  const code = useQuery({ queryKey: ['orders', 'customer', 'pickup-code', order.orderId, order.orderStatus], queryFn: () => orderApi.pickupCode(order.orderId), staleTime: 0, gcTime: 0 });
  const size = Math.min(210, width - 140);
  const ready = order.orderStatus === 'READY_FOR_PICKUP';
  if (code.isPending) return <Skeleton height={size + 170} radius={radius.pass} />;
  if (code.isError) return <ErrorState title="Chưa lấy được mã nhận món" error={code.error} onRetry={() => void code.refetch()} />;
  return (
    <>
      <Pass
        accent={ready ? colors.leaf : colors.brand}
        head={
          <View style={{ alignItems: 'center', gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.ink }}>Mã nhận món</Text>
              {ready ? <StatusPill label="Sẵn sàng" tone="ok" /> : null}
            </View>
            <Pressable
              onPress={() => setOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Mã QR nhận món. Chạm để phóng to"
              style={({ pressed }) => ({ padding: 14, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: colors.white, borderWidth: 2, borderColor: ready ? colors.leafTint : colors.brandTint, transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <PermitQr value={code.data.token} size={size} />
            </Pressable>
            <Text selectable maxFontSizeMultiplier={1.3} accessibilityLabel={`Mã chữ ${code.data.shortCode.split('').join(' ')}`} style={[sign.title, { letterSpacing: 6, color: colors.ink }, tabular]}>
              {code.data.shortCode}
            </Text>
          </View>
        }
        stub={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon sf="hand.tap" md="touch_app" size={18} color={colors.primary} />
            <Text style={[text.footnote, { flex: 1, color: colors.muted }]}>Đưa quán quét mã, hoặc đọc mã chữ. Chạm vào mã để phóng to, sáng tối đa.</Text>
          </View>
        }
      />
      {open ? <FullCode token={code.data.token} shortCode={code.data.shortCode} onClose={() => setOpen(false)} /> : null}
    </>
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
        <Text selectable maxFontSizeMultiplier={1.3} style={[sign.figure, { letterSpacing: 6, color: colors.ink }, tabular]}>
          {shortCode}
        </Text>
        <Button label="Đóng" variant="secondary" onPress={onClose} style={{ paddingHorizontal: 28 }} />
      </View>
    </Modal>
  );
}

/** A label and its value on one row of a grouped list (receipt, payment). */
function ValueRow({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <View accessible style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[text.body, { color: colors.ink, fontFamily: strong ? fonts.bold : fonts.regular }]}>{label}</Text>
        {sub ? <Text style={[text.footnote, { color: colors.onMango }]}>{sub}</Text> : null}
      </View>
      <Text selectable style={[strong ? { fontFamily: fonts.heavy, fontSize: 17, color: colors.ink } : [text.callout, { color: colors.muted }], tabular, { textAlign: 'right', maxWidth: '55%' }]}>
        {value}
      </Text>
    </View>
  );
}

/** The 5-step journey (or the steps reached and where it stopped), with the time of each. */
function JourneyBar({ status, history }: { status: OrderStatus; history: Order['statusHistory'] }) {
  const steps = buildTrackingSteps(status, history);
  const progress = trackingProgress(steps);
  const stopped = status === 'CANCELLED' || status === 'REJECTED';
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`Tiến trình đơn: ${steps.map((s) => `${s.label}${s.state === 'current' ? ' (hiện tại)' : ''}`).join(', ')}`}>
      <View style={{ position: 'absolute', left: 14, right: 14, top: 13, height: 4, borderRadius: 2, backgroundColor: colors.sunken }}>
        <View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 2, backgroundColor: stopped ? colors.danger : colors.leaf }} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {steps.map((s) => {
          const bg = s.state === 'done' ? colors.leaf : s.state === 'current' ? colors.cta : s.state === 'stopped' ? colors.danger : colors.sunken;
          return (
            <View key={s.status} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: bg, borderWidth: 3, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                {s.state === 'done' ? (
                  <Icon sf="checkmark" md="check" size={12} color={colors.white} weight="bold" />
                ) : s.state === 'stopped' ? (
                  <Icon sf="xmark" md="close" size={12} color={colors.white} weight="bold" />
                ) : s.state === 'current' ? (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white }} />
                ) : null}
              </View>
              <Text maxFontSizeMultiplier={1.4} style={[text.caption, { color: s.state === 'upcoming' ? colors.muted : colors.ink, textAlign: 'center' }]}>
                {s.label}
              </Text>
              {s.reachedAt ? (
                <Text maxFontSizeMultiplier={1.4} style={[{ fontFamily: fonts.medium, fontSize: 11, color: colors.muted }, tabular]}>
                  {formatOrderTime(s.reachedAt)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function OrderDetailSkeleton() {
  return (
    <Screen gap={20}>
      <Stack.Screen options={{ title: 'Đơn hàng', headerRight: () => null }} />
      <Skeleton height={170} radius={radius.card} />
      <Skeleton height={380} radius={radius.pass} />
      <Skeleton height={72} radius={radius.card} />
      <Skeleton height={160} radius={radius.card} />
    </Screen>
  );
}

/**
 * V-C12 Chi tiết đơn (ORD-02): where the order stands and when it will be ready, the pickup code
 * as a pass, where to collect, then the receipt. One action at the bottom, chosen by the stage
 * (pay, say you are coming, open the code, review); rare ones (complain, cancel) sit behind "…".
 */
export function CustomerOrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const online = useOnline();
  const order = useCustomerOrder(orderId);
  const tracking = useOrderTracking(order.data?.orderId, order.data?.orderStatus);
  useReadyNotice(order.data?.orderStatus);
  const refresh = useRefreshAfterOrderMutation('customer', Number(orderId));
  const announce = useAnnounceArrival(order.data?.orderId);
  const [locatingEta, setLocatingEta] = useState(false);
  // Remembered per order: a link can swap the order under this same screen.
  const [codeOpenFor, setCodeOpenFor] = useState<string | null>(null);
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);
  const codeOpen = codeOpenFor === orderId;
  const historyOpen = historyOpenFor === orderId;
  const setCodeOpen = (v: boolean) => setCodeOpenFor(v ? orderId : null);
  const arrivalNow = useNow(15_000);
  const cancel = useMutation({
    mutationFn: () => orderApi.cancel(order.data!.orderId),
    onSuccess: async (next) => {
      await refresh.update(next);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Đã huỷ đơn; yêu cầu hoàn tiền đang được xử lý nếu đã thanh toán');
    },
    onError: async (e) => {
      await refresh.handleError(e);
      showToast(errorMessage(e), 'error');
    },
  });

  if (order.isPending) return <OrderDetailSkeleton />;
  if (order.isError || !order.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Đơn hàng', headerRight: () => null }} />
        <ErrorState error={order.error ?? new Error('Không tìm thấy đơn.')} onRetry={() => void order.refetch()} />
      </Screen>
    );
  }
  const d = order.data;
  const pending = d.orderStatus === 'PENDING_PAYMENT';
  const collectable = COLLECTABLE_ORDER_STATUSES.has(d.orderStatus);
  const ready = d.orderStatus === 'READY_FOR_PICKUP';
  const stopped = d.orderStatus === 'CANCELLED' || d.orderStatus === 'REJECTED';
  const live = !TERMINAL_ORDER_STATUSES.has(d.orderStatus);
  const canCancel = d.orderStatus === 'PLACED';
  const canComplain = d.paymentStatus === 'SUCCESS' && !['PENDING_PAYMENT', 'PLACED'].includes(d.orderStatus);
  const canReview = d.orderStatus === 'COMPLETED';
  const refund = d.refundStatus ? refundPresentation(d.refundStatus) : null;
  const t = tracking.data;
  const point = t?.pickupPoint;
  // At most 3 notices an order (the server refuses more), one every 2 minutes, none once the stall has seen it.
  const sentAt = announce.data?.notifiedAt ?? t?.arrivalNotifiedAt ?? null;
  const canAnnounce = (!sentAt || arrivalNow - Date.parse(sentAt) >= 2 * 60_000) && (t?.arrivalNoticeCount ?? 0) < 3 && !t?.arrivalAcknowledgedAt;
  const est = t?.readyEstimate;
  const cooking = d.orderStatus === 'PLACED' || d.orderStatus === 'ACCEPTED' || d.orderStatus === 'PREPARING';

  const sayComing = async () => {
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
      onSuccess: (notice) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(notice.alreadySent ? 'Quán đã nhận được thông báo của bạn.' : 'Đã báo quán bạn đang đến.');
      },
      onError: (e) => showToast(errorMessage(e), 'error'),
    });
  };
  const askCancel = () =>
    Alert.alert('Huỷ đơn hàng?', 'Chỉ đơn quán chưa nhận mới huỷ được. Nếu đã thanh toán, hệ thống tạo yêu cầu hoàn tiền.', [
      { text: 'Giữ đơn', style: 'cancel' },
      { text: 'Huỷ đơn', style: 'destructive', onPress: () => cancel.mutate() },
    ]);
  const openDirections = () => {
    if (point) void Linking.openURL(directionsUrl(point.latitude, point.longitude));
  };
  const announceLabel = t?.arrivalAcknowledgedAt ? 'Quán đã thấy bạn' : sentAt ? 'Báo lại quán' : 'Tôi đang đến';
  const announceButton = (primary: boolean) => (
    <Button
      label={announceLabel}
      variant={primary ? 'primary' : 'secondary'}
      size={56}
      icon={{ sf: 'figure.walk', md: 'directions_walk' }}
      loading={announce.isPending || locatingEta}
      disabled={!canAnnounce || announce.isPending || locatingEta}
      onPress={() => void sayComing()}
      style={{ flex: 1 }}
    />
  );

  const footer = pending ? (
    <Button label="Kiểm tra thanh toán" size={56} icon={{ sf: 'creditcard.fill', md: 'payments' }} onPress={() => go(`/customer/orders/${d.orderId}/payment`)} />
  ) : ready ? (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {announceButton(false)}
      <Button label="Mở mã" size={56} icon={{ sf: 'qrcode', md: 'qr_code_2' }} onPress={() => setCodeOpen(true)} style={{ flex: 1 }} />
    </View>
  ) : collectable ? (
    announceButton(true)
  ) : canReview ? (
    <Button label="Đánh giá đơn" size={56} icon={{ sf: 'star.fill', md: 'star' }} onPress={() => go(`/customer/orders/${d.orderId}/review`)} />
  ) : stopped && canComplain ? (
    <Button label="Khiếu nại, hoàn tiền" variant="secondary" size={56} icon={{ sf: 'exclamationmark.bubble', md: 'feedback' }} onPress={() => go(`/customer/orders/${d.orderId}/complaint`)} />
  ) : undefined;

  const menu = [
    ...(canComplain && !stopped ? [{ id: 'complain', title: 'Khiếu nại, yêu cầu hoàn tiền', icon: { sf: 'exclamationmark.bubble', md: 'feedback' }, onPress: () => go(`/customer/orders/${d.orderId}/complaint`) }] : []),
    ...(canCancel ? [{ id: 'cancel', title: cancel.isPending ? 'Đang huỷ…' : 'Huỷ đơn', icon: { sf: 'xmark.circle', md: 'cancel' }, destructive: true, disabled: cancel.isPending, onPress: askCancel }] : []),
  ];
  const history = [...d.statusHistory].sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt));
  const payRows = [
    <ValueRow key="wallet" label="Ví" value={providerName(d.paymentProvider) ?? 'Chưa chọn ví'} />,
    d.paymentStatus ? <ValueRow key="pay" label="Trạng thái" value={statusLabel(d.paymentStatus).label} /> : null,
    d.placedAt ? <ValueRow key="placed" label="Đặt lúc" value={formatOrderDate(d.placedAt)} /> : null,
    d.completedAt ? <ValueRow key="done" label="Nhận lúc" value={formatOrderDate(d.completedAt)} /> : null,
  ];

  return (
    <Screen gap={20} footer={footer} onRefresh={() => void Promise.all([order.refetch(), tracking.refetch()])} refreshing={order.isRefetching}>
      <Stack.Screen options={{ title: `#${d.orderCode}`, headerRight: () => (menu.length ? <MoreButton title={`Đơn #${d.orderCode}`} items={menu} /> : null) }} />
      {!online ? <StatusHeader tone="neutral" icon={{ sf: 'wifi.slash', md: 'wifi_off' }} title="Mất kết nối" detail="Trạng thái đơn có thể chưa mới." /> : null}

      {pending ? (
        <StatusHeader tone="pending" icon={{ sf: 'creditcard.fill', md: 'payments' }} title="Đang chờ xác nhận thanh toán" detail="Trạng thái chỉ đổi khi máy chủ nhận xác nhận hợp lệ từ ví." />
      ) : (
        <View accessibilityLiveRegion="polite" style={{ gap: 16, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: ready ? colors.leafTint : stopped ? colors.dangerTint : colors.card }}>
          <View style={{ gap: 6 }}>
            {live ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? colors.leaf : colors.muted }} />
                <Text style={[text.caption, { color: colors.muted }]}>{online ? 'Tự cập nhật' : 'Tạm dừng cập nhật'}</Text>
              </View>
            ) : null}
            <Text accessibilityRole="header" style={[text.title2, { color: ready ? colors.onLeaf : stopped ? colors.onDanger : colors.ink }]}>
              {TRACKING_HEADLINES[d.orderStatus]}
            </Text>
            {est && cooking ? (
              <Text style={[text.subhead, { color: est.isLate ? colors.onDanger : colors.ink }, tabular]}>
                {est.isLate ? 'Lâu hơn thường lệ một chút. ' : ''}
                {est.earliestReadyAt && est.latestReadyAt ? `Dự kiến xong ${formatOrderTime(est.earliestReadyAt)}–${formatOrderTime(est.latestReadyAt)}` : `Thường mất ${est.lowMinutes}–${est.highMinutes} phút`}
                {t && t.ordersAhead > 0 ? `, ${t.ordersAhead} đơn trước bạn` : ''}
              </Text>
            ) : null}
          </View>
          <JourneyBar status={d.orderStatus} history={d.statusHistory} />
        </View>
      )}

      {collectable ? (
        <PickupPass order={d} open={codeOpen} setOpen={setCodeOpen} />
      ) : pending ? (
        <View style={{ alignItems: 'center', gap: 6, padding: 20, borderRadius: radius.pass, borderCurve: 'continuous', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line }}>
          <Icon sf="qrcode" md="qr_code_2" size={28} color={colors.muted} />
          <Text style={[text.footnote, { color: colors.muted, textAlign: 'center' }]}>Mã nhận món hiện khi thanh toán được xác nhận.</Text>
        </View>
      ) : null}

      <ListGroup title="Lấy món tại">
        <ListRow
          title={d.storefront.storefrontName}
          subtitle={point?.address ?? d.storefront.address ?? undefined}
          icon={{ sf: 'mappin.and.ellipse', md: 'location_on' }}
          chevron={false}
        />
        {point ? <ListRow title="Chỉ đường tới quán" subtitle="Mở bản đồ của máy" icon={{ sf: 'arrow.triangle.turn.up.right.diamond.fill', md: 'directions' }} onPress={openDirections} /> : null}
        {collectable ? (
          <ListRow
            title={t?.arrivalAcknowledgedAt ? 'Quán đã thấy bạn đang đến' : sentAt ? `Đã báo quán lúc ${formatOrderTime(sentAt)}` : 'Sắp tới quầy?'}
            subtitle={t?.arrivalAcknowledgedAt ? `Lúc ${formatOrderTime(t.arrivalAcknowledgedAt)}` : sentAt ? 'Báo lại được sau 2 phút, tối đa 3 lần.' : 'Báo quán để món vừa xong khi bạn tới.'}
            icon={{ sf: 'figure.walk', md: 'directions_walk' }}
            tint={colors.primary}
            tileColor={colors.brandTint}
            chevron={false}
          />
        ) : null}
      </ListGroup>

      {d.rejectionReason ? <StatusHeader tone="danger" title="Lý do quán từ chối" detail={d.rejectionReason} /> : null}
      {refund ? (
        <StatusHeader
          tone={refund.tone === 'ok' ? 'ok' : refund.tone === 'danger' ? 'danger' : 'pending'}
          icon={{ sf: 'arrow.uturn.backward.circle.fill', md: 'currency_exchange' }}
          title={`${refund.label}${d.refundAmount ? `: ${formatVnd(d.refundAmount)}` : ''}`}
          detail={refund.message}
        />
      ) : null}

      <ListGroup title="Món đã đặt" inset={16}>
        {d.items.map((i) => (
          <ValueRow key={i.orderItemId} label={`${i.quantity}× ${i.itemName}`} value={formatVnd(i.lineTotal)} sub={i.note ? `Ghi chú: ${i.note}` : undefined} />
        ))}
        <ValueRow key="total" label="Tổng thanh toán" value={formatVnd(d.totalAmount)} strong />
      </ListGroup>

      <ListGroup title="Thanh toán" inset={16} footer="Nhận món trực tiếp tại điểm bán.">
        {payRows.filter(Boolean)}
      </ListGroup>

      {history.length ? (
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden' }}>
          <ListRow
            title="Lịch sử cập nhật"
            value={`${history.length} lần`}
            icon={{ sf: 'clock.arrow.circlepath', md: 'history' }}
            tint={colors.muted}
            tileColor={colors.sunken}
            onPress={() => setHistoryOpenFor(historyOpen ? null : orderId)}
            chevron={false}
            accessory={<Icon sf={historyOpen ? 'chevron.up' : 'chevron.down'} md={historyOpen ? 'expand_less' : 'expand_more'} size={14} color={colors.muted} />}
          />
          {historyOpen
            ? history.map((h, i) => (
                <View key={h.historyId ?? i} style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.separator }}>
                  <Text style={[text.footnote, { width: 96, color: colors.muted }, tabular]}>{formatOrderDate(h.changedAt)}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[text.subhead, { color: colors.ink }]}>{statusLabel(h.toStatus).label}</Text>
                    {h.note ? <Text style={[text.footnote, { color: colors.muted }]}>{h.note}</Text> : null}
                  </View>
                </View>
              ))
            : null}
        </View>
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
      <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
        <StorePhoto storefront={order.data.storefront} size={88} />
        <Text style={[sign.plate, { color: colors.muted }]}>#{order.data.orderCode}</Text>
        <Text accessibilityRole="header" style={[text.title2, { color: colors.ink, textAlign: 'center' }]}>Món ở {order.data.storefront.storefrontName} thế nào?</Text>
      </View>
      {!completed ? (
        <Banner tone="neutral">Chỉ đánh giá được đơn đã hoàn tất.</Banner>
      ) : (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }} accessibilityRole="adjustable" accessibilityValue={{ min: 1, max: 5, now: current }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${n} sao`}>
                <Icon sf={n <= current ? 'star.fill' : 'star'} md="star" size={46} color={n <= current ? colors.mango : colors.line} />
              </Pressable>
            ))}
          </View>
          <View style={{ alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.sticker, borderCurve: 'continuous', backgroundColor: colors.sticker, transform: [{ rotate: '-3deg' }], boxShadow: '0 8px 16px -8px rgba(17, 28, 43, 0.45)' }}>
            <Text maxFontSizeMultiplier={1.3} style={[sign.price, { fontSize: 24, lineHeight: 30, color: colors.plate }]}>{RATING_WORDS[current - 1]}</Text>
          </View>
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
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <StorePhoto storefront={d.storefront} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 21, color: colors.ink }}>{d.storefront.storefrontName}</Text>
          <Text style={[sign.plate, { fontSize: 14, color: colors.muted }]}>#{d.orderCode}</Text>
        </View>
        <Text maxFontSizeMultiplier={1.4} style={[sign.price, { fontSize: 20, lineHeight: 26, color: colors.ink }, tabular]}>{formatVnd(d.totalAmount)}</Text>
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

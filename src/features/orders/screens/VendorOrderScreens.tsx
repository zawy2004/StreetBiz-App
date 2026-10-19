import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Card, KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { ApiError } from '@/core/api/problem';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, shadow, tabular, text } from '@/theme';
import { formatVnd } from '@/utils/format';
import { enteredStageAt, lateCount, providerLabel, tallyItems } from '@/features/storefronts/orders-view';
import { orderApi } from '../api/orderApi';
import { formatOrderDate, formatOrderTime, formatWait, minutesSince, ticketItemsShown, waitTone } from '../components/order-format';
import { vendorActionsFor } from '../components/vendor-actions';
import { orderKeys, useVendorOrder, useVendorOrderCounts, useVendorOrders } from '../hooks/useOrders';
import { useVendorArrivals } from '../hooks/useOrderTracking';
import type { Order, OrderArrival, OrderStatus } from '../types/order.types';

type Stage = 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY_FOR_PICKUP';
type Tab = Stage | 'COMPLETED' | 'CLOSED';
type Kind = 'accept' | 'reject' | 'preparing' | 'ready';

/** Each stage its own colour: chili for what just came in, ink accepted, turmeric cooking, leaf ready. */
const STAGES: { value: Stage; label: string; ink: string; wash: string }[] = [
  { value: 'PLACED', label: 'Đơn mới', ink: colors.white, wash: colors.danger },
  { value: 'ACCEPTED', label: 'Đã nhận', ink: colors.white, wash: colors.plate },
  { value: 'PREPARING', label: 'Đang làm', ink: colors.onMango, wash: colors.mango },
  { value: 'READY_FOR_PICKUP', label: 'Chờ lấy', ink: colors.white, wash: colors.leaf },
];
const STAGE_STATUSES = STAGES.map((s) => s.value);
const TAB_STATUSES: Record<Tab, OrderStatus | readonly OrderStatus[]> = {
  PLACED: 'PLACED',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  COMPLETED: 'COMPLETED',
  CLOSED: ['REJECTED', 'CANCELLED'],
};
const TAB_GUIDE: Record<Tab, string> = {
  PLACED: 'Khách đã thanh toán. Bấm "Nhận đơn" để khách biết quán đang làm.',
  ACCEPTED: 'Đơn đã nhận, chưa bắt đầu làm.',
  PREPARING: 'Làm xong thì bấm "Sẵn sàng lấy món" để báo khách tới lấy.',
  READY_FOR_PICKUP: 'Khách tới thì quét mã nhận hàng trên máy khách để giao đơn.',
  COMPLETED: 'Đơn đã giao tận tay khách.',
  CLOSED: 'Đơn bạn đã từ chối hoặc khách đã hủy.',
};
const EMPTY: Record<Tab, { sf: string; md: string; title: string; body: string }> = {
  PLACED: { sf: 'tray', md: 'inbox', title: 'Chưa có đơn mới', body: 'Đơn khách vừa thanh toán sẽ hiện ở đây ngay.' },
  ACCEPTED: { sf: 'checkmark.circle', md: 'check_circle', title: 'Không có đơn chờ làm', body: 'Đơn đã nhận nằm ở đây tới khi bắt đầu chuẩn bị.' },
  PREPARING: { sf: 'flame', md: 'local_fire_department', title: 'Bếp đang trống', body: 'Đơn đang làm sẽ hiện ở đây.' },
  READY_FOR_PICKUP: { sf: 'qrcode.viewfinder', md: 'qr_code_scanner', title: 'Không có đơn chờ lấy', body: 'Đơn làm xong chờ ở đây tới khi bạn quét mã của khách.' },
  COMPLETED: { sf: 'doc.text', md: 'receipt_long', title: 'Chưa có đơn hoàn thành', body: 'Đơn giao xong được lưu ở đây.' },
  CLOSED: { sf: 'doc.text', md: 'receipt_long', title: 'Không có đơn bị từ chối hay hủy', body: 'Đơn bạn từ chối hoặc khách hủy được lưu ở đây.' },
};
const DONE_TOAST: Record<Kind, string> = {
  accept: 'Đã nhận đơn. Đơn chuyển sang "Đã nhận".',
  preparing: 'Đã bắt đầu làm. Đơn chuyển sang "Đang làm".',
  ready: 'Đã báo khách tới lấy. Đơn chuyển sang "Chờ lấy".',
  reject: 'Đã từ chối đơn; yêu cầu hoàn tiền đang được xử lý.',
};
const PAGE_SIZE = 10;
const go = (href: string) => router.push(href as Href);

function useNowTick(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Moves an order one stage along; a 409 means someone else moved it first, so the board re-reads. */
function useTransition(onDone?: () => void) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, order, reason }: { kind: Kind; order: Order; reason?: string }) => {
      if (kind === 'accept') return orderApi.accept(order.orderId);
      if (kind === 'reject') return orderApi.reject(order.orderId, reason!.trim());
      if (kind === 'preparing') return orderApi.preparing(order.orderId);
      return orderApi.readyForPickup(order.orderId);
    },
    onSuccess: async (updated, { kind }) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      cache.setQueryData(orderKeys.vendorDetail(updated.orderId), updated);
      await Promise.all([cache.invalidateQueries({ queryKey: orderKeys.vendorLists }), cache.invalidateQueries({ queryKey: ['orders', 'vendor', 'sales'] })]);
      showToast(DONE_TOAST[kind]);
      onDone?.();
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) {
        await cache.invalidateQueries({ queryKey: orderKeys.vendorLists });
        showToast('Trạng thái đơn đã thay đổi. Danh sách vừa được tải lại.', 'info');
      } else showToast(errorMessage(error), 'error');
    },
  });
}

/** V36 Đơn hàng (ORD-03..06): the kitchen board — four stations, tickets with the next step on each. */
export function VendorOrdersScreen() {
  const cache = useQueryClient();
  const [tab, setTab] = useState<Tab>('PLACED');
  const [page, setPage] = useState(1);
  const now = useNowTick(30_000);
  const orders = useVendorOrders({ status: TAB_STATUSES[tab], page, pageSize: PAGE_SIZE });
  const counts = useVendorOrderCounts(STAGE_STATUSES);
  const arrivals = useVendorArrivals();
  const transition = useTransition();
  // "Đã thấy" straight from the ticket, as on the web's board: the buyer learns the stall saw them.
  const ack = useMutation({
    mutationFn: (orderId: number) => orderApi.acknowledgeArrival(orderId),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ['orders', 'vendor', 'arrivals'] }),
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const totalPages = orders.data?.totalPages ?? 0;
  // Accepting the last order on the last page empties it: step back to the new last page.
  if (totalPages > 0 && page > totalPages) setPage(totalPages);
  const items = useMemo(() => orders.data?.items ?? [], [orders.data]);
  const tally = useMemo(() => tallyItems(items), [items]);
  const late = useMemo(() => lateCount(items, now), [items, now]);
  const openTab = (t: Tab) => {
    void Haptics.selectionAsync();
    setTab(t);
    setPage(1);
  };
  const busyId = transition.isPending ? transition.variables?.order.orderId : undefined;

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {STAGES.map((s) => {
          const on = tab === s.value;
          const n = counts[s.value];
          return (
            <Pressable
              key={s.value}
              onPress={() => openTab(s.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${s.label}${n != null ? `, ${n} đơn` : ''}`}
              style={{ minWidth: 92, paddingVertical: 10, paddingHorizontal: 12, gap: 2, borderRadius: 16, borderCurve: 'continuous', backgroundColor: on ? s.wash : colors.card, borderWidth: on ? 0 : 1, borderColor: colors.line }}
            >
              <Text style={[{ fontFamily: fonts.code, fontSize: 24, lineHeight: 28, color: on ? s.ink : n ? colors.ink : colors.muted }, tabular]}>{n ?? '·'}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? s.ink : colors.ink }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[text.caption, { color: colors.muted }]}>Lịch sử</Text>
        <Chip label="Hoàn thành" selected={tab === 'COMPLETED'} onPress={() => openTab('COMPLETED')} accessibilityRole="radio" />
        <Chip label="Từ chối / hủy" selected={tab === 'CLOSED'} onPress={() => openTab('CLOSED')} accessibilityRole="radio" />
      </View>
      <Text style={[text.footnote, { color: colors.ink }]}>{TAB_GUIDE[tab]}</Text>
      {tab === 'PLACED' && late > 0 ? (
        <Banner tone="danger" icon={{ sf: 'alarm.fill', md: 'alarm' }} title={`${late} đơn chờ hơn 10 phút`}>Khách đã trả tiền và đang chờ. Nhận hoặc từ chối ngay.</Banner>
      ) : null}
      {(tab === 'ACCEPTED' || tab === 'PREPARING') && tally.length > 0 ? (
        <View style={{ padding: 14, gap: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.mangoTint }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.onMango }}>Cần làm trong trang này</Text>
          <Text style={[text.footnote, { color: colors.onMango }]}>{tally.map((t) => `${t.quantity}× ${t.itemName}`).join(' · ')}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Đơn hàng' }} />
      <FlatList
        data={orders.isPending ? [] : items}
        keyExtractor={(o) => String(o.orderId)}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 120, gap: 12 }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={orders.isRefetching && !orders.isPending} onRefresh={() => void cache.invalidateQueries({ queryKey: orderKeys.vendorLists })} tintColor={colors.cta} colors={[colors.cta]} />}
        renderItem={({ item }) => (
          <Ticket
            order={item}
            now={now}
            arrival={arrivals.get(item.orderId)}
            acking={ack.isPending && ack.variables === item.orderId}
            onAcknowledge={() => ack.mutate(item.orderId)}
            busy={busyId === item.orderId}
            disabled={transition.isPending}
            onAct={(kind) => transition.mutate({ kind, order: item })}
          />
        )}
        ListEmptyComponent={
          orders.isPending ? (
            <ListSkeleton rows={3} height={170} />
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
          ) : (
            <StateView icon={{ sf: EMPTY[tab].sf, md: EMPTY[tab].md }} tone="neutral" title={EMPTY[tab].title} body={EMPTY[tab].body} />
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
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
        <Pressable
          onPress={() => go('/vendor/orders/scan')}
          accessibilityRole="button"
          accessibilityLabel="Quét mã nhận hàng của khách"
          style={({ pressed }) => ({ height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: pressed ? colors.ctaPressed : colors.cta, boxShadow: shadow.raised, transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <Icon sf="qrcode.viewfinder" md="qr_code_scanner" size={22} color={colors.white} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>Quét mã nhận hàng</Text>
          {counts.READY_FOR_PICKUP ? (
            <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.primary }, tabular]}>{counts.READY_FOR_PICKUP}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

/** One ticket: who, when, how long it has waited, the dishes with notes, and the one next step. */
function Ticket({
  order,
  now,
  arrival,
  acking,
  onAcknowledge,
  busy,
  disabled,
  onAct,
}: {
  order: Order;
  now: number;
  arrival?: OrderArrival;
  acking: boolean;
  onAcknowledge: () => void;
  busy: boolean;
  disabled: boolean;
  onAct: (k: Kind) => void;
}) {
  const waited = minutesSince(enteredStageAt(order), now);
  const urgency = order.orderStatus === 'PLACED' ? waitTone(waited) : 'calm';
  const shown = order.items.slice(0, ticketItemsShown(order.items.length));
  const hidden = order.items.length - shown.length;
  const stage = STAGES.find((s) => s.value === order.orderStatus);
  const waitWash = urgency === 'late' ? colors.dangerTint : urgency === 'warn' ? colors.mangoTint : colors.sunken;
  const waitInk = urgency === 'late' ? colors.onDanger : urgency === 'warn' ? colors.onMango : colors.ink;
  const s = statusLabel(order.orderStatus);
  const open = () => go(`/vendor/orders/${order.orderId}`);

  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden', borderWidth: urgency === 'late' ? 2 : 0, borderColor: colors.danger }}>
      {stage ? <View style={{ height: 5, backgroundColor: stage.wash }} /> : null}
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Đơn ${order.orderCode}, ${order.customerName || 'khách hàng'}`} style={({ pressed }) => ({ padding: 14, gap: 10, backgroundColor: pressed ? colors.pressed : 'transparent' })}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[text.headline, { color: colors.ink }]} numberOfLines={1}>{order.customerName || 'Khách hàng'}</Text>
            <Text style={[text.caption, { color: colors.muted }, tabular]}>#{order.orderCode} · {formatOrderTime(order.placedAt ?? order.createdAt)}</Text>
          </View>
          {stage ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: waitWash }}>
              <Icon sf="clock" md="schedule" size={12} color={waitInk} />
              <Text style={[{ fontFamily: fonts.bold, fontSize: 12, color: waitInk }, tabular]}>{formatWait(waited)}</Text>
            </View>
          ) : (
            <StatusPill label={s.label} tone={s.tone} />
          )}
        </View>
        {arrival && !arrival.acknowledgedAt ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.signTint }}>
            <Icon sf="figure.walk" md="directions_walk" size={16} color={colors.sign} />
            <Text style={[text.footnote, { flex: 1, color: colors.sign }]} numberOfLines={2}>{arrival.message}</Text>
            <Pressable onPress={onAcknowledge} disabled={acking} accessibilityRole="button" accessibilityLabel="Báo khách: quán đã thấy" hitSlop={6} style={({ pressed }) => ({ paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: pressed ? colors.signTint : colors.white, borderWidth: 1, borderColor: colors.sign })}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.sign }}>{acking ? 'Đang báo…' : 'Đã thấy'}</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={{ gap: 6 }}>
          {shown.map((it) => (
            <View key={it.orderItemId} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.primary, minWidth: 30 }, tabular]}>{it.quantity}×</Text>
                <Text style={[text.body, { flex: 1, color: colors.ink, fontFamily: fonts.semibold }]}>{it.itemName}</Text>
              </View>
              {it.note ? (
                <Text style={[text.footnote, { marginLeft: 38, color: colors.onMango, fontFamily: fonts.semibold }]}>Ghi chú: {it.note}</Text>
              ) : null}
            </View>
          ))}
          {hidden > 0 ? <Text style={[text.footnote, { color: colors.muted, marginLeft: 38 }]}>+{hidden} món nữa</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderColor: colors.separator }}>
          <Text style={[text.caption, { color: colors.muted }]}>{order.paymentProvider ? `Đã trả qua ${providerLabel(order.paymentProvider)}` : 'Đã thanh toán'}</Text>
          <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }, tabular]}>{formatVnd(order.totalAmount)}</Text>
        </View>
      </Pressable>
      {order.orderStatus === 'PLACED' ? (
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 }}>
          <Button label="Từ chối" variant="secondary" disabled={disabled} onPress={() => go(`/vendor/orders/${order.orderId}?reject=1`)} style={{ flex: 1 }} />
          <Button label="Nhận đơn" icon={{ sf: 'checkmark', md: 'check' }} loading={busy} disabled={disabled} onPress={() => onAct('accept')} style={{ flex: 1.6 }} />
        </View>
      ) : order.orderStatus === 'ACCEPTED' ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <Button label="Bắt đầu chuẩn bị" icon={{ sf: 'flame.fill', md: 'local_fire_department' }} loading={busy} disabled={disabled} onPress={() => onAct('preparing')} />
        </View>
      ) : order.orderStatus === 'PREPARING' ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <Button label="Sẵn sàng lấy món" icon={{ sf: 'bell.fill', md: 'notifications_active' }} loading={busy} disabled={disabled} onPress={() => onAct('ready')} />
        </View>
      ) : order.orderStatus === 'READY_FOR_PICKUP' ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <Button label="Quét mã để giao" variant="sign" icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={() => go('/vendor/orders/scan')} />
        </View>
      ) : null}
    </View>
  );
}

/** Chi tiết đơn (người bán): the ticket in full, its history, and every action including the two that need words. */
export function VendorOrderDetailScreen() {
  const { orderId, reject } = useLocalSearchParams<{ orderId: string; reject?: string }>();
  const cache = useQueryClient();
  const order = useVendorOrder(orderId);
  const arrival = useVendorArrivals().get(Number(orderId));
  const [rejecting, setRejecting] = useState(reject === '1');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [noCode, setNoCode] = useState(false);
  const [noCodeReason, setNoCodeReason] = useState('');
  const transition = useTransition(() => {
    setRejecting(false);
    setReason('');
  });
  const handover = useMutation({
    mutationFn: (written: string) => orderApi.handoverWithoutCode(order.data!.orderId, written.trim()),
    onSuccess: async (updated) => {
      cache.setQueryData(orderKeys.vendorDetail(updated.orderId), updated);
      await cache.invalidateQueries({ queryKey: orderKeys.vendorLists });
      setNoCode(false);
      showToast('Đã giao đơn; lý do không có mã được lưu vào lịch sử đơn');
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });
  const ack = useMutation({
    mutationFn: () => orderApi.acknowledgeArrival(Number(orderId)),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ['orders', 'vendor', 'arrivals'] }),
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  if (order.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Chi tiết đơn' }} />
        <ListSkeleton rows={1} height={240} />
      </Screen>
    );
  }
  if (order.isError || !order.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Chi tiết đơn' }} />
        <ErrorState error={order.error ?? new Error('Không tìm thấy đơn.')} onRetry={() => void order.refetch()} />
      </Screen>
    );
  }
  const data = order.data;
  const actions = vendorActionsFor(data.orderStatus);
  const s = statusLabel(data.orderStatus);
  const busy = transition.isPending;

  const footer = actions.includes('accept') ? (
    rejecting ? (
      <Button
        label="Xác nhận từ chối"
        size={56}
        loading={busy}
        onPress={() => {
          if (!reason.trim()) return setReasonError('Vui lòng nhập lý do từ chối.');
          transition.mutate({ kind: 'reject', order: data, reason });
        }}
        style={{ backgroundColor: colors.danger }}
      />
    ) : (
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Từ chối" variant="secondary" size={56} disabled={busy} onPress={() => setRejecting(true)} style={{ flex: 1 }} />
        <Button label="Nhận đơn" size={56} icon={{ sf: 'checkmark', md: 'check' }} loading={busy} onPress={() => transition.mutate({ kind: 'accept', order: data })} style={{ flex: 1.6 }} />
      </View>
    )
  ) : actions.includes('preparing') ? (
    <Button label="Bắt đầu chuẩn bị" size={56} loading={busy} onPress={() => transition.mutate({ kind: 'preparing', order: data })} />
  ) : actions.includes('ready') ? (
    <Button label="Sẵn sàng lấy món" size={56} loading={busy} onPress={() => transition.mutate({ kind: 'ready', order: data })} />
  ) : actions.includes('handover') ? (
    noCode ? (
      <Button
        label="Giao đơn không có mã"
        size={56}
        loading={handover.isPending}
        onPress={() => {
          if (noCodeReason.trim().length < 5) return showToast('Ghi rõ lý do (ít nhất 5 ký tự).', 'error');
          handover.mutate(noCodeReason);
        }}
      />
    ) : (
      <Button label="Quét mã nhận hàng của khách" size={56} icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={() => go('/vendor/orders/scan')} />
    )
  ) : undefined;

  return (
    <Screen footer={footer} onRefresh={() => void order.refetch()} refreshing={order.isRefetching}>
      <Stack.Screen options={{ title: `#${data.orderCode}` }} />
      {arrival ? (
        <Banner
          tone="info"
          icon={{ sf: 'figure.walk', md: 'directions_walk' }}
          title="Khách đang đến"
          action={arrival.acknowledgedAt ? undefined : { label: ack.isPending ? 'Đang báo…' : 'Đã thấy', onPress: () => ack.mutate() }}
        >
          {arrival.message}
        </Banner>
      ) : null}
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[text.title3, { color: colors.ink }]}>{data.customerName || 'Khách hàng'}</Text>
            <Text style={[text.caption, { color: colors.muted }]}>{formatOrderDate(data.placedAt ?? data.createdAt)}</Text>
          </View>
          <StatusPill label={s.label} tone={s.tone} />
        </View>
        {data.items.map((it) => (
          <View key={it.orderItemId} style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.primary, minWidth: 32 }, tabular]}>{it.quantity}×</Text>
            <View style={{ flex: 1 }}>
              <Text style={[text.body, { color: colors.ink, fontFamily: fonts.semibold }]}>{it.itemName}</Text>
              {it.note ? <Text style={[text.footnote, { color: colors.onMango }]}>Ghi chú: {it.note}</Text> : null}
            </View>
            <Text style={[text.callout, { color: colors.ink }, tabular]}>{formatVnd(it.lineTotal)}</Text>
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: colors.separator }} />
        <KeyValueList
          rows={[
            { label: 'Tổng tiền', value: formatVnd(data.totalAmount), emphasis: true },
            data.paymentProvider ? { label: 'Thanh toán', value: providerLabel(data.paymentProvider) } : null,
            data.rejectionReason ? { label: 'Lý do từ chối', value: data.rejectionReason } : null,
            data.refundStatus ? { label: 'Hoàn tiền', value: `${formatVnd(data.refundAmount ?? 0)} · ${statusLabel(data.refundStatus).label}` } : null,
          ]}
        />
      </Card>

      {rejecting && actions.includes('reject') ? (
        <View style={{ gap: 10 }}>
          <Banner tone="danger">Từ chối thì khách được hoàn tiền. Ghi rõ lý do để khách hiểu.</Banner>
          <TextField label="Lý do từ chối" value={reason} onChangeText={(v) => { setReason(v); setReasonError(undefined); }} error={reasonError} multiline placeholder="VD: Hết món này hôm nay" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['Hết món', 'Quán sắp đóng cửa', 'Đang quá đông khách'].map((r) => (
              <Chip key={r} label={r} selected={reason === r} onPress={() => { setReason(r); setReasonError(undefined); }} />
            ))}
          </View>
          <Pressable onPress={() => setRejecting(false)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.muted }}>Không từ chối nữa</Text>
          </Pressable>
        </View>
      ) : null}

      {actions.includes('handover') ? (
        noCode ? (
          <View style={{ gap: 10 }}>
            <Banner tone="warning" title="Giao khi khách không có mã">Lý do được ghi vào lịch sử đơn và khách thấy được. Chỉ dùng khi đã chắc đúng người nhận.</Banner>
            <TextField label="Lý do" value={noCodeReason} onChangeText={setNoCodeReason} multiline placeholder="VD: Máy khách hết pin, đã đối chiếu tên và món" />
            <Pressable onPress={() => setNoCode(false)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.muted }}>Quay lại quét mã</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setNoCode(true)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Khách không có mã?</Text>
          </Pressable>
        )
      ) : null}

      <Card style={{ gap: 10 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Tiến trình</Text>
        {[...data.statusHistory].reverse().map((h, i) => (
          <View key={`${h.toStatus}-${h.changedAt}-${i}`} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: i === 0 ? colors.cta : colors.line }} />
            <View style={{ flex: 1 }}>
              <Text style={[text.subhead, { color: colors.ink }]}>{statusLabel(h.toStatus).label}</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{formatOrderDate(h.changedAt)}{h.note ? ` · ${h.note}` : ''}</Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

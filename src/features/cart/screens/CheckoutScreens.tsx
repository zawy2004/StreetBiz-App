import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, Text, View } from 'react-native';

import { KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { commerceApi, errorMessage } from '@/core/api';
import { env, isDev } from '@/core/config/env';
import { uuid } from '@/core/utils/uuid';
import { directionsUrl } from '@/features/buyer-discovery/discovery-format';
import { LOCATE_MESSAGES } from '@/features/buyer-discovery/geolocation';
import { WalletPicker } from '@/features/fee-schedules/components/FinanceParts';
import { orderApi } from '@/features/orders/api/orderApi';
import { useOnline, providerName } from '@/features/orders/components/order-display';
import { formatOrderDate } from '@/features/orders/components/order-format';
import { useCheckoutOrder, useCustomerOrder, useRefreshAfterOrderMutation } from '@/features/orders/hooks/useOrders';
import { isSandboxPaymentUrl, redirectToPayment } from '@/features/orders/payment-redirect';
import { distanceLabel } from '@/features/orders/pickup/pickup-range';
import { usePickupRange } from '@/features/orders/pickup/usePickupRange';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, sign, tabular, text } from '@/theme';
import { BigNumber, Pass, Signboard } from '@/ui';
import { formatVnd } from '@/utils/format';
import { CART_KEY, useCart } from '../cart-api';

type Provider = 'MOMO' | 'ZALOPAY';
/** Only Development has the sandbox confirm/fail endpoints; elsewhere a real gateway is used. */
const sandboxPayments = isDev && env.enablePaymentSandbox;
/** The range notice's corner (its own `radius` below is the pickup radius in metres). */
const NOTICE_RADIUS = radius.photo;

function blockReason(storefrontStatus: string | undefined, availability: string[]): string | null {
  if (storefrontStatus !== 'OPEN') {
    return storefrontStatus === 'PAUSED' ? 'Quán đang tạm dừng nhận đơn nên chưa đặt được. Giỏ vẫn được giữ.' : 'Quán đang đóng cửa nên chưa đặt được. Giỏ vẫn được giữ.';
  }
  if (availability.some((s) => s !== 'AVAILABLE')) return 'Có món không còn bán. Giảm món đó về 0 để tiếp tục.';
  return null;
}

/**
 * V-C09 Thanh toán (ORD-01, BR-37): the pickup point and whether the buyer is near enough to
 * collect, the dishes, the wallet, one button. One idempotency key per attempt; the server
 * re-checks the very position this screen judged.
 */
export function CheckoutScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const online = useOnline();
  const cart = useCart();
  const place = useCheckoutOrder();
  const [provider, setProvider] = useState<Provider>('MOMO');
  // One key per cart and wallet (a different cart is a different purchase), kept in a ref with a synchronous
  // guard so two quick taps before a re-render still share it (the web's idempotencyKey ref).
  const attempt = useRef<{ cartId: number; provider: Provider; key: string } | null>(null);
  const submitting = useRef(false);
  const range = usePickupRange(cart.data?.items.length && !cart.data.pendingOrderId ? cart.data.storefrontId : undefined);

  if (user?.role_code !== 'CUSTOMER') {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thanh toán' }} />
        <StateView icon={{ sf: 'person.crop.circle', md: 'account_circle' }} title="Đăng nhập để đặt hàng" body="Giỏ hàng và đơn đặt trước gắn với tài khoản người mua." action={{ label: 'Đăng nhập', onPress: () => router.push('/auth/sign-in') }} />
      </Screen>
    );
  }
  if (cart.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thanh toán' }} />
        <ListSkeleton rows={4} height={70} />
      </Screen>
    );
  }
  if (cart.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thanh toán' }} />
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
      </Screen>
    );
  }
  const data = cart.data;
  if (!data || data.items.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thanh toán' }} />
        <StateView icon={{ sf: 'bag', md: 'shopping_bag' }} title="Giỏ hàng trống" body="Chọn món ở Khám phá rồi quay lại thanh toán." action={{ label: 'Về Khám phá', onPress: () => router.dismissTo('/customer/explore' as Href) }} />
      </Screen>
    );
  }
  if (data.pendingOrderId) {
    const pendingId = data.pendingOrderId;
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thanh toán' }} />
        <StateView icon={{ sf: 'clock.fill', md: 'schedule' }} title="Bạn có một đơn đang chờ thanh toán" body="Thanh toán hoặc huỷ đơn đó trước khi đặt đơn mới từ giỏ này." action={{ label: 'Tiếp tục thanh toán', onPress: () => router.replace(`/customer/orders/${pendingId}/payment` as Href) }} />
      </Screen>
    );
  }

  const reason = blockReason(data.storefrontStatus, data.items.map((i) => i.availabilityStatus));
  const count = data.items.reduce((n, i) => n + i.quantity, 0);
  const pay = () => {
    if (submitting.current || place.isPending || reason || !range.canOrder) return;
    // The same key for a retried tap on the same cart, so the server never charges twice (BR-37).
    // A switched wallet is a new attempt too: the server refuses a key reused for another provider.
    if (attempt.current?.cartId !== data.cartId || attempt.current.provider !== provider) attempt.current = { cartId: data.cartId, provider, key: uuid() };
    submitting.current = true;
    place.mutate(
      { cartId: data.cartId, provider, idempotencyKey: attempt.current.key, location: range.location },
      {
        onSettled: () => {
          submitting.current = false;
        },
        onSuccess: async (checkout) => {
          await Promise.all([queryClient.invalidateQueries({ queryKey: CART_KEY }), queryClient.invalidateQueries({ queryKey: ['orders', 'customer', 'list'] })]);
          router.replace(`/customer/orders/${checkout.orderId}/payment` as Href);
          // A configured MoMo merchant returns a real https page: open it; the payment screen checks on return.
          if (!isSandboxPaymentUrl(checkout.paymentUrl)) {
            showToast('Đang mở ví để thanh toán', 'info');
            redirectToPayment(checkout.paymentUrl);
          }
        },
      },
    );
  };

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          {place.isError ? <Text accessibilityRole="alert" style={[text.footnote, { color: colors.onDanger }]}>{errorMessage(place.error)}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View>
              <Text style={[text.caption, { color: colors.muted }, tabular]}>Tổng {count} món</Text>
              <Text maxFontSizeMultiplier={1.3} style={[sign.price, { fontSize: 26, lineHeight: 32, color: colors.ink }, tabular]}>{formatVnd(data.subtotal)}</Text>
            </View>
            <Button label={place.isPending ? 'Đang khởi tạo…' : 'Thanh toán'} size={56} icon={{ sf: 'lock.fill', md: 'lock' }} loading={place.isPending} disabled={!!reason || !range.canOrder || !online} onPress={pay} style={{ flex: 1 }} />
          </View>
        </View>
      }
    >
      <Stack.Screen options={{ title: 'Thanh toán' }} />
      {!online ? <Banner tone="warning">Mất kết nối. Cần có mạng để thanh toán.</Banner> : null}
      {reason ? <Banner tone="danger">{reason}</Banner> : null}

      {/* The receipt as a ticket: where to collect, then the dishes on the stub */}
      <Pass
        head={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="storefront.fill" md="storefront" size={24} color={colors.white} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.caption, { color: colors.muted }]}>Đến lấy tại quầy</Text>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, color: colors.ink }}>{data.storefrontName}</Text>
              <Text style={[text.footnote, { color: colors.muted }]}>{data.storefrontAddress || 'Địa chỉ điểm bán chưa được cập nhật'}</Text>
            </View>
          </View>
        }
        stub={
          <View style={{ gap: 12 }}>
            {data.items.map((i) => (
              <View key={i.cartItemId} style={{ flexDirection: 'row', gap: 10 }}>
                <Text maxFontSizeMultiplier={1.4} style={[sign.price, { color: colors.primary, minWidth: 34 }, tabular]}>{i.quantity}×</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[text.callout, { color: colors.ink, fontFamily: fonts.semibold }]}>{i.itemName}</Text>
                  {i.note ? <Text style={[text.caption, { color: colors.onMango }]}>Ghi chú: {i.note}</Text> : null}
                  {i.availabilityStatus !== 'AVAILABLE' ? <Text style={[text.caption, { color: colors.onDanger }]}>Món này không còn bán</Text> : null}
                </View>
                <Text style={[text.callout, { color: colors.ink, fontFamily: fonts.semibold }, tabular]}>{formatVnd(i.unitPrice * i.quantity)}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: colors.separator }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <Text style={[text.subhead, { color: colors.ink }]}>Tạm tính</Text>
              <Text maxFontSizeMultiplier={1.3} style={[sign.price, { fontSize: 24, lineHeight: 30, color: colors.ink }, tabular]}>{formatVnd(data.subtotal)}</Text>
            </View>
          </View>
        }
      />

      <RangeNotice range={range} />

      <WalletPicker value={provider} onChange={setProvider} disabled={place.isPending} />
      <Text style={[text.caption, { color: colors.muted }]}>
        Giá và tên món được lưu lúc đặt. Đơn chỉ chuyển cho quán sau khi ví xác nhận thanh toán; bạn tự đến quầy lấy món.
      </Text>
    </Screen>
  );
}

/** ORD-01: is the buyer close enough to collect? Updates as they move, and always says how to fix it. */
function RangeNotice({ range }: { range: ReturnType<typeof usePickupRange> }) {
  const { info, live, verdict, enforced } = range;
  if (!enforced) return null;
  const radius = info.data ? distanceLabel(info.data.radiusMeters) : null;
  const why = `StreetBiz chỉ nhận đơn khi bạn ở trong phạm vi ${radius ?? 'cho phép'} quanh quán, vì bạn sẽ tự đến quầy lấy món.`;
  const panel = (title: string, body: string, action?: { label: string; onPress: () => void }) => (
    <Banner tone="warning" icon={{ sf: 'location.fill', md: 'location_on' }} title={title} action={action}>
      {body}
    </Banner>
  );
  if (live.status === 'DENIED') return panel('Cần quyền vị trí để đặt món', `${why} Cho phép định vị trong Cài đặt rồi thử lại.`, { label: 'Mở Cài đặt', onPress: () => void Linking.openSettings() });
  if (live.status === 'UNAVAILABLE' || live.status === 'FAILED') return panel(LOCATE_MESSAGES[live.status], why, { label: 'Thử lại', onPress: live.retry });
  if (!verdict) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 4 }}>
        <ActivityIndicator size="small" color={colors.cta} />
        <Text style={[text.footnote, { color: colors.muted }]}>Đang xác định vị trí của bạn…</Text>
      </View>
    );
  }
  if (verdict.status === 'INACCURATE') return panel(`Vị trí chưa đủ chính xác (sai số ${distanceLabel(verdict.accuracyMeters)})`, 'Bật GPS hoặc chế độ định vị chính xác, ra chỗ thoáng hơn rồi thử lại.', { label: 'Thử lại', onPress: live.retry });
  if (verdict.status === 'OUT_OF_RANGE') {
    const p = info.data?.pickupPoint;
    return panel(`Bạn đang cách quán ${distanceLabel(verdict.distanceMeters)}`, `${why} Khoảng cách tự cập nhật khi bạn đến gần hơn.`, p ? { label: 'Chỉ đường đến quán', onPress: () => void Linking.openURL(directionsUrl(p.latitude, p.longitude)) } : undefined);
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: NOTICE_RADIUS, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf="figure.walk" md="directions_walk" size={18} color={colors.white} />
      </View>
      <Text style={[text.footnote, { flex: 1, color: colors.onLeaf, fontFamily: fonts.semibold }]}>
        Bạn cách quán {distanceLabel(verdict.distanceMeters)}, trong phạm vi nhận món {radius}
      </Text>
    </View>
  );
}

/**
 * V-C10 Trạng thái thanh toán: only what the server says counts (BR-32). Back from MoMo, the
 * server asks MoMo; in the development sandbox the buyer picks the outcome.
 */
export function OrderPaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const order = useCustomerOrder(orderId);
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterOrderMutation('customer', Number(orderId));
  const options = useQuery({ queryKey: ['orders', 'payment-options'], queryFn: commerceApi.paymentOptions, staleTime: 5 * 60_000 });
  const action = useMutation({
    mutationFn: (kind: 'pay' | 'fail' | 'cancel' | 'sync') => {
      const id = Number(orderId);
      if (kind === 'pay') return orderApi.confirmSandboxPayment(id);
      if (kind === 'fail') return orderApi.failSandboxPayment(id);
      if (kind === 'sync') return orderApi.syncPayment(id);
      return orderApi.cancel(id);
    },
    onSuccess: async (next, kind) => {
      await refresh.update(next);
      await queryClient.invalidateQueries({ queryKey: CART_KEY });
      if (kind === 'sync') {
        if (next.orderStatus === 'PLACED') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast('Ví đã xác nhận thanh toán');
        }
        return;
      }
      if (kind === 'pay') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(kind === 'pay' ? 'Thanh toán thành công' : kind === 'fail' ? 'Đã giả lập thanh toán thất bại' : 'Đã huỷ đơn', kind === 'pay' ? 'success' : 'info');
    },
    onError: async (error) => {
      await refresh.handleError(error);
      showToast(errorMessage(error), 'error');
    },
  });
  const pendingNow = order.data?.orderStatus === 'PENDING_PAYMENT';
  const syncedOnce = useRef(false);
  const viaGateway = order.data?.paymentProvider === 'MOMO' && options.data?.mode === 'LIVE';
  useEffect(() => {
    if (pendingNow && !syncedOnce.current) {
      syncedOnce.current = true;
      action.mutate('sync');
    }
  }, [pendingNow, action]);
  // Back from the wallet app: ask the server again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && pendingNow && viaGateway && !action.isPending) action.mutate('sync');
    });
    return () => sub.remove();
  }, [pendingNow, viaGateway, action]);

  if (order.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thanh toán' }} />
        <ListSkeleton rows={1} height={240} />
      </Screen>
    );
  }
  if (order.isError || !order.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thanh toán' }} />
        <ErrorState title="Không tải được trạng thái thanh toán" error={order.error} onRetry={() => void order.refetch()} />
      </Screen>
    );
  }
  const data = order.data;
  const pending = data.orderStatus === 'PENDING_PAYMENT';
  const placed = data.orderStatus === 'PLACED';
  const failed = data.orderStatus === 'CANCELLED';
  const showSandbox = sandboxPayments && !viaGateway;
  const gateway = providerName(data.paymentProvider) ?? 'ví';
  const busy = (k: string) => action.isPending && action.variables === k;
  const look = pending
    ? { paint: colors.brand, line1: 'Chờ ví', line2: 'xác nhận', ink: colors.plate, sf: 'hourglass', md: 'hourglass_top', title: 'Đang chờ ví xác nhận', body: viaGateway ? `Nếu bạn đã thanh toán trên ${gateway}, bấm "Kiểm tra lại".` : showSandbox ? 'Môi trường thử nghiệm chưa nối cổng thanh toán thật. Chọn kết quả bên dưới.' : 'Hệ thống tự kiểm tra trạng thái với máy chủ.' }
    : placed
      ? { paint: colors.leaf, line1: 'Đặt món', line2: 'thành công', ink: colors.white, sf: 'checkmark.seal.fill', md: 'verified', title: 'Đặt món thành công', body: 'Máy chủ đã xác nhận thanh toán và chuyển đơn cho quán.' }
      : failed
        ? { paint: colors.danger, line1: 'Chưa', line2: 'thanh toán', ink: colors.white, sf: 'xmark.octagon.fill', md: 'error', title: 'Thanh toán thất bại hoặc đơn đã huỷ', body: 'Thanh toán thất bại hoặc đơn đã huỷ. Giỏ hàng vẫn được giữ để bạn kiểm tra và đặt lại.' }
        : { paint: colors.leaf, line1: 'Đã', line2: 'thanh toán', ink: colors.white, sf: 'checkmark.circle.fill', md: 'check_circle', title: 'Đã thanh toán', body: 'Thanh toán đã được máy chủ xác nhận.' };

  return (
    <Screen padded={false} gap={18} onRefresh={() => void order.refetch()} refreshing={order.isRefetching}>
      <Stack.Screen options={{ title: `Đơn #${data.orderCode}` }} />
      {/* The verdict painted across the top: only the server's word counts (BR-32) */}
      <View accessibilityLiveRegion="polite">
        <Signboard
          compact
          color={look.paint}
          kerb={pending}
          line2Color={look.ink}
          line1={look.line1}
          line2={look.line2}
          caption={look.body}
          overlap={
            <Pass
              head={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <BigNumber value={formatVnd(data.totalAmount)} label={data.storefront.storefrontName} style={{ flex: 1 }} />
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: pending ? colors.mangoTint : placed ? colors.leafTint : failed ? colors.dangerTint : colors.leafTint, alignItems: 'center', justifyContent: 'center' }}>
                    {busy('sync') ? <ActivityIndicator color={colors.onMango} /> : <Icon sf={look.sf} md={look.md} size={26} color={pending ? colors.onMango : failed ? colors.danger : colors.leaf} />}
                  </View>
                </View>
              }
              stub={
                <View style={{ gap: 6 }}>
                  <KeyValueList
                    rows={[
                      { label: 'Mã đơn', value: `#${data.orderCode}`, mono: true },
                      { label: 'Ví', value: gateway },
                      { label: 'Đặt lúc', value: formatOrderDate(data.placedAt ?? data.createdAt) },
                    ]}
                  />
                  {order.dataUpdatedAt ? <Text style={[text.caption, { color: colors.muted }]}>Kiểm tra gần nhất lúc {new Date(order.dataUpdatedAt).toLocaleTimeString('vi-VN')}</Text> : null}
                  {options.data?.message?.trim() ? <Text style={[text.caption, { color: colors.muted }]}>{options.data.message.trim()}</Text> : null}
                </View>
              }
            />
          }
        >
          {pending ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Icon sf="lock.fill" md="lock" size={13} color={colors.white} />
              <Text style={[text.caption, { flex: 1, color: colors.white }]}>Giỏ bị khoá cho tới khi đơn được thanh toán hoặc huỷ.</Text>
            </View>
          ) : null}
        </Signboard>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        {pending && showSandbox ? (
          <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.mango }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon sf="testtube.2" md="science" size={15} color={colors.onMango} />
              <Text style={{ fontFamily: fonts.heavy, fontSize: 14, color: colors.onMango }}>Thử nghiệm, không phải tiền thật</Text>
            </View>
            <Button label="Thanh toán thử (thành công)" loading={busy('pay')} disabled={action.isPending} onPress={() => action.mutate('pay')} />
            <Button label="Giả lập thanh toán thất bại" variant="secondary" loading={busy('fail')} disabled={action.isPending} onPress={() => action.mutate('fail')} />
          </View>
        ) : null}
        {pending && viaGateway ? <Button label="Kiểm tra lại" size={56} icon={{ sf: 'arrow.clockwise', md: 'refresh' }} loading={busy('sync')} disabled={action.isPending} onPress={() => action.mutate('sync')} /> : null}
        {failed ? <Button label="Về giỏ hàng" onPress={() => router.dismissTo('/customer/explore' as Href)} /> : null}
        <Button label="Xem chi tiết đơn" variant={placed ? 'primary' : 'secondary'} size={placed ? 56 : 50} onPress={() => router.replace(`/customer/orders/${data.orderId}` as Href)} />
        {pending ? (
          <Pressable onPress={() => action.mutate('cancel')} disabled={action.isPending} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.onDanger }}>{busy('cancel') ? 'Đang huỷ…' : 'Huỷ đơn này'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { Sheet } from '@/components/common/Sheet';
import type { CommerceCart } from '@/core/api';
import { assetUrl } from '@/core/api/asset-url';
import { statusLabel } from '@/core/constants/status-labels';
import { menuItemPhotos } from '@/features/buyer-discovery/food-photos';
import type { Order } from '@/features/orders/types/order.types';
import { colors, fonts, radius, space, tabular, text } from '@/theme';
import { formatVnd } from '@/utils/format';
import { cartCount, useClearCart, useSetCartQuantity } from '../cart-api';

const go = (href: string) => router.push(href as Href);

/** − n + in an orange capsule; reaching 0 removes the dish. */
export function QtyStepper({
  quantity,
  onChange,
  name,
  compact,
  busy,
}: {
  quantity: number;
  onChange: (next: number) => void;
  name: string;
  compact?: boolean;
  busy?: boolean;
}) {
  const size = compact ? 30 : 34;
  const step = (next: number) => {
    if (busy) return;
    void Haptics.selectionAsync();
    onChange(next);
  };
  const btn = (icon: { sf: string; md: string }, label: string, next: number) => (
    <Pressable
      onPress={() => step(next)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${name}`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon sf={icon.sf} md={icon.md} size={compact ? 14 : 16} color={colors.white} weight="bold" />
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.cta,
        opacity: busy ? 0.7 : 1,
        boxShadow: '0 4px 10px -4px rgba(238, 85, 0, 0.55)',
      }}
    >
      {btn({ sf: 'minus', md: 'remove' }, 'Bớt', quantity - 1)}
      <Text
        style={[
          {
            fontFamily: fonts.bold,
            fontSize: compact ? 14 : 15,
            color: colors.white,
            minWidth: 14,
            textAlign: 'center',
          },
          tabular,
        ]}
        accessibilityLabel={`${quantity} phần`}
      >
        {quantity}
      </Text>
      {btn({ sf: 'plus', md: 'add' }, 'Thêm', quantity + 1)}
    </View>
  );
}

/**
 * The floating cart bar (ShopeeFood, Uber Eats): count, stall, total, one tap to the cart.
 * A native safe-area view keeps it clear of the tab bar and home indicator on both platforms.
 */
export function CartBar({
  cart,
  onPress,
}: {
  cart: CommerceCart | null | undefined;
  onPress: () => void;
}) {
  if (!cart || cart.items.length === 0) return null;
  const count = cartCount(cart);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <SafeAreaView edges={['bottom']} mode="padding" pointerEvents="box-none">
        <PressableScale
          onPress={onPress}
          accessibilityLabel={`Xem giỏ: ${count} món của ${cart.storefrontName}, ${formatVnd(cart.subtotal)}`}
          style={{
            marginHorizontal: space.md,
            marginBottom: 12,
            height: 60,
            borderRadius: 30,
            backgroundColor: colors.cta,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 8,
            paddingRight: 20,
            gap: 12,
            boxShadow: '0 14px 28px -12px rgba(238, 85, 0, 0.7)',
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sf="bag.fill" md="shopping_bag" size={20} color={colors.white} />
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 19,
                height: 19,
                borderRadius: 10,
                paddingHorizontal: 4,
                backgroundColor: colors.mango,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[{ fontFamily: fonts.bold, fontSize: 11, color: colors.onMango }, tabular]}>
                {count}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.white }}>Xem giỏ</Text>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.92)' }}
            >
              {cart.storefrontName}
            </Text>
          </View>
          <Text style={[{ fontFamily: fonts.heavy, fontSize: 17, color: colors.white }, tabular]}>
            {formatVnd(cart.subtotal)}
          </Text>
        </PressableScale>
      </SafeAreaView>
    </View>
  );
}

/** The cart as a native sheet: lines with steppers, the total, one button on to checkout. */
export function CartSheet({
  cart,
  visible,
  onClose,
}: {
  cart: CommerceCart | null | undefined;
  visible: boolean;
  onClose: () => void;
}) {
  const setQty = useSetCartQuantity();
  const clear = useClearCart();
  const items = cart?.items ?? [];
  const pending = cart?.pendingOrderId != null;
  const subtotal = cart?.subtotal ?? 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Giỏ hàng"
      subtitle={cart?.storefrontName ? `Đến lấy tại ${cart.storefrontName}` : undefined}
      footer={
        items.length ? (
          <View style={{ gap: 12, marginTop: 4 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingHorizontal: 4,
              }}
            >
              <Text style={[text.callout, { color: colors.muted }]}>Tạm tính</Text>
              <Text style={[{ fontFamily: fonts.heavy, fontSize: 22, color: colors.ink }, tabular]}>
                {formatVnd(subtotal)}
              </Text>
            </View>
            {pending ? (
              <Text style={[text.footnote, { color: colors.onMango, paddingHorizontal: 4 }]}>
                Đơn từ giỏ này đang chờ thanh toán. Hoàn tất hoặc huỷ đơn đó trước khi sửa giỏ.
              </Text>
            ) : null}
            <Button
              label={pending ? 'Tiếp tục thanh toán' : `Đặt trước · ${formatVnd(subtotal)}`}
              size={56}
              icon={{ sf: 'bag.fill', md: 'shopping_bag' }}
              onPress={() => {
                onClose();
                go(pending ? `/customer/orders/${cart?.pendingOrderId}/payment` : '/checkout');
              }}
            />
            {!pending ? (
              <Pressable
                onPress={() =>
                  Alert.alert('Xoá cả giỏ?', `Bỏ ${cartCount(cart)} món của ${cart?.storefrontName}.`, [
                    { text: 'Huỷ', style: 'cancel' },
                    {
                      text: 'Xoá giỏ',
                      style: 'destructive',
                      onPress: () => {
                        clear.mutate();
                        onClose();
                      },
                    },
                  ])
                }
                accessibilityRole="button"
                style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted }}>
                  Xoá giỏ
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null
      }
    >
      {items.length ? (
        items.map((l, i) => {
          const own = assetUrl(l.imageUrl);
          const photo = own
            ? { uri: own }
            : menuItemPhotos({ menuItemId: l.menuItemId, itemName: l.itemName, categoryName: '' })[0]
                ?.source;
          return (
            <View
              key={l.menuItemId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                backgroundColor: colors.card,
              }}
            >
              <Image
                source={photo}
                style={{ width: 54, height: 54, borderRadius: 12 }}
                contentFit="cover"
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={[text.headline, { color: colors.ink }]}>
                  {l.itemName}
                </Text>
                <Text style={[text.subhead, tabular, { color: colors.primary }]}>
                  {formatVnd(l.unitPrice * l.quantity)}
                </Text>
                {l.availabilityStatus !== 'AVAILABLE' ? (
                  <Text style={[text.caption, { color: colors.onDanger }]}>Món này vừa hết</Text>
                ) : null}
              </View>
              {pending ? (
                <Text style={[text.headline, tabular, { color: colors.muted }]}>×{l.quantity}</Text>
              ) : (
                <QtyStepper
                  quantity={l.quantity}
                  name={l.itemName}
                  busy={setQty.isPending}
                  onChange={(n) => setQty.mutate({ menuItemId: l.menuItemId, quantity: n })}
                  compact
                />
              )}
              {i < items.length - 1 ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 78,
                    right: 0,
                    bottom: 0,
                    height: 1,
                    backgroundColor: colors.separator,
                  }}
                />
              ) : null}
            </View>
          );
        })
      ) : (
        <View style={{ backgroundColor: colors.card, padding: 24, alignItems: 'center', gap: 8 }}>
          <Icon sf="bag" md="shopping_bag" size={30} color={colors.cta} />
          <Text style={[text.headline, { color: colors.ink }]}>Giỏ đang trống</Text>
          <Text style={[text.footnote, { color: colors.muted, textAlign: 'center' }]}>
            Bấm dấu + ở món bạn thích để thêm vào giỏ.
          </Text>
        </View>
      )}
    </Sheet>
  );
}

const STEPS = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'] as const;

/** The order in progress, on top of Khám phá (Starbucks, Grab): status and a 4-step progress. */
export function ActiveOrderCard({ order }: { order: Order }) {
  const ready = order.orderStatus === 'READY_FOR_PICKUP';
  const awaitingPayment = order.orderStatus === 'PENDING_PAYMENT';
  const step = STEPS.indexOf(order.orderStatus as (typeof STEPS)[number]);
  const label = ready
    ? 'Món đã xong, mời bạn đến lấy'
    : awaitingPayment
      ? 'Đơn đang chờ thanh toán'
      : statusLabel(order.orderStatus).label;
  return (
    <PressableScale
      onPress={() =>
        go(
          awaitingPayment
            ? `/customer/orders/${order.orderId}/payment`
            : `/customer/orders/${order.orderId}`,
        )
      }
      accessibilityLabel={`Đơn ${order.orderCode} ở ${order.storefront.storefrontName}: ${label}`}
      style={{
        marginHorizontal: space.md,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: ready ? colors.leafTint : colors.card,
        padding: 14,
        gap: 12,
        borderWidth: 1.5,
        borderColor: ready ? colors.leaf : awaitingPayment ? colors.mango : colors.brandTint,
        boxShadow: '0 8px 22px -14px rgba(17, 28, 43, 0.35)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: ready ? colors.leaf : awaitingPayment ? colors.mango : colors.cta,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            sf={ready ? 'checkmark' : awaitingPayment ? 'creditcard.fill' : 'flame.fill'}
            md={ready ? 'check' : awaitingPayment ? 'credit_card' : 'local_fire_department'}
            size={20}
            color={awaitingPayment ? colors.onMango : colors.white}
            weight="bold"
          />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.bold, fontSize: 15.5, color: ready ? colors.onLeaf : colors.ink }}
          >
            {label}
          </Text>
          <Text numberOfLines={1} style={[text.footnote, { color: colors.muted }]}>
            {order.orderCode}, {order.storefront.storefrontName}
          </Text>
        </View>
        <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
      </View>
      {step >= 0 ? (
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                backgroundColor: i <= step ? (ready ? colors.leaf : colors.cta) : colors.sunken,
              }}
            />
          ))}
        </View>
      ) : null}
    </PressableScale>
  );
}

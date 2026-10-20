import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { Sheet } from '@/components/common/Sheet';
import { EmptyArt } from '@/components/native/EmptyArt';
import type { CommerceCart } from '@/core/api';
import { assetUrl } from '@/core/api/asset-url';
import { statusLabel } from '@/core/constants/status-labels';
import { menuItemPhotos } from '@/features/buyer-discovery/food-photos';
import type { Order } from '@/features/orders/types/order.types';
import { colors, fonts, radius, shadow, sign, space, tabular, text } from '@/theme';
import { formatVnd } from '@/utils/format';
import { cartCount, useClearCart, useSetCartQuantity } from '../cart-api';

const go = (href: string) => router.push(href as Href);

/**
 * − n + in an orange capsule; reaching 0 removes the dish. v5: a white rim so it reads on a
 * photo's corner as well as on white, each button at least 44 pt to the finger (hit slop).
 */
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
  const size = compact ? 34 : 40;
  const step = (next: number) => {
    if (busy) return;
    void Haptics.selectionAsync();
    onChange(next);
  };
  const btn = (icon: { sf: string; md: string }, label: string, next: number) => (
    <Pressable
      onPress={() => step(next)}
      hitSlop={{ top: (44 - size) / 2 + 2, bottom: (44 - size) / 2 + 2, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${name}`}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.ctaPressed : 'transparent',
      })}
    >
      <Icon sf={icon.sf} md={icon.md} size={compact ? 14 : 16} color={colors.white} weight="bold" />
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: size + 4,
        borderRadius: radius.full,
        backgroundColor: colors.cta,
        borderWidth: 2,
        borderColor: colors.white,
        opacity: busy ? 0.7 : 1,
        boxShadow: '0 6px 14px -6px rgba(238, 85, 0, 0.7)',
      }}
    >
      {btn({ sf: 'minus', md: 'remove' }, 'Bớt', quantity - 1)}
      <Text
        maxFontSizeMultiplier={1.4}
        style={[
          {
            fontFamily: fonts.code,
            fontSize: compact ? 16 : 18,
            color: colors.white,
            minWidth: 16,
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

/** The half-moon punched out of a ticket at its tear line; `color` is whatever lies behind. */
function Punch({ edge, color }: { edge: 'top' | 'bottom'; color: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -8,
        [edge]: -8,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: color,
      }}
    />
  );
}

/**
 * The floating cart bar, v5: an orange ticket over the screen. The bag and how many dishes on
 * the left with the stall, a dashed tear with two punched notches, and the stub on the right
 * carrying the total in sign figures. One tap opens the cart. A native safe-area view keeps it
 * clear of the tab bar and home indicator on both platforms.
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
            borderRadius: radius.card,
            borderCurve: 'continuous',
            boxShadow: shadow.glow,
          }}
        >
          <View
            style={{
              minHeight: 64,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: colors.cta,
              flexDirection: 'row',
              alignItems: 'stretch',
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 10, paddingRight: 14, paddingVertical: 10 }}>
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
                    top: -4,
                    right: -6,
                    minWidth: 22,
                    minHeight: 22,
                    borderRadius: radius.sticker,
                    paddingHorizontal: 5,
                    backgroundColor: colors.sticker,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ rotate: '6deg' }],
                  }}
                >
                  <Text maxFontSizeMultiplier={1.3} style={[{ fontFamily: fonts.code, fontSize: 13, lineHeight: 16, color: colors.plate }, tabular]}>
                    {count}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 21, color: colors.white }}>Xem giỏ</Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: 'rgba(255,255,255,0.92)' }}>
                  {cart.storefrontName}
                </Text>
              </View>
            </View>
            {/* The stub: the tear line with its punched notches, and the total */}
            <View style={{ justifyContent: 'center' }}>
              <View style={{ position: 'absolute', left: -1, top: 10, bottom: 10, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.6)' }} />
              <Punch edge="top" color={colors.canvas} />
              <Punch edge="bottom" color={colors.canvas} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 14 }}>
                <Text maxFontSizeMultiplier={1.3} style={[sign.price, { fontSize: 21, lineHeight: 26, color: colors.white }, tabular]}>
                  {formatVnd(cart.subtotal)}
                </Text>
                <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.white} weight="bold" />
              </View>
            </View>
          </View>
        </PressableScale>
      </SafeAreaView>
    </View>
  );
}

/** The cart as a native sheet: dishes with their photos and steppers, the total in sign figures, one button on. */
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
                alignItems: 'flex-end',
                paddingHorizontal: 4,
              }}
            >
              <View>
                <Text style={[text.subhead, { color: colors.ink }]}>Tạm tính</Text>
                <Text style={[text.footnote, { color: colors.muted }, tabular]}>{cartCount(cart)} món, trả qua ví</Text>
              </View>
              <Text maxFontSizeMultiplier={1.3} style={[sign.price, { fontSize: 28, lineHeight: 34, color: colors.ink }, tabular]}>
                {formatVnd(subtotal)}
              </Text>
            </View>
            {pending ? (
              <Text style={[text.footnote, { color: colors.onMango, paddingHorizontal: 4 }]}>
                Đơn từ giỏ này đang chờ thanh toán. Hoàn tất hoặc huỷ đơn đó trước khi sửa giỏ.
              </Text>
            ) : null}
            <Button
              label={pending ? 'Tiếp tục thanh toán' : 'Đặt trước'}
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
                style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.muted }}>
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
          const soldOut = l.availabilityStatus !== 'AVAILABLE';
          return (
            <View
              key={l.menuItemId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
                backgroundColor: colors.card,
              }}
            >
              <Image
                source={photo}
                style={{ width: 60, height: 60, borderRadius: radius.control, opacity: soldOut ? 0.5 : 1 }}
                contentFit="cover"
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2} style={[text.headline, { color: colors.ink }]}>
                  {l.itemName}
                </Text>
                <Text maxFontSizeMultiplier={1.4} style={[sign.price, { fontSize: 17, color: colors.primary }, tabular]}>
                  {formatVnd(l.unitPrice * l.quantity)}
                </Text>
                {soldOut ? (
                  <Text style={[text.caption, { color: colors.onDanger }]}>Món này vừa hết</Text>
                ) : null}
              </View>
              {pending ? (
                <Text style={[sign.price, { color: colors.muted }, tabular]}>×{l.quantity}</Text>
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
                    left: 84,
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
        <View style={{ backgroundColor: colors.card, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', gap: 6 }}>
          <EmptyArt icon={{ sf: 'bag', md: 'shopping_bag' }} />
          <Text style={[text.headline, { color: colors.ink, marginTop: 8 }]}>Giỏ đang trống</Text>
          <Text style={[text.footnote, { color: colors.muted, textAlign: 'center' }]}>
            Bấm dấu + ở món bạn thích để thêm vào giỏ.
          </Text>
        </View>
      )}
    </Sheet>
  );
}

const STEPS = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'] as const;

/**
 * The order in progress, on top of Khám phá (Starbucks, Grab), v5: a white ticket with the
 * stage's colour down its edge, the order code in sign figures and a 4-step progress.
 */
export function ActiveOrderCard({ order }: { order: Order }) {
  const ready = order.orderStatus === 'READY_FOR_PICKUP';
  const awaitingPayment = order.orderStatus === 'PENDING_PAYMENT';
  const step = STEPS.indexOf(order.orderStatus as (typeof STEPS)[number]);
  const label = ready
    ? 'Món đã xong, mời bạn đến lấy'
    : awaitingPayment
      ? 'Đơn đang chờ thanh toán'
      : statusLabel(order.orderStatus).label;
  const accent = ready ? colors.leaf : awaitingPayment ? colors.mango : colors.cta;
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
        marginHorizontal: 20,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        boxShadow: shadow.card,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: ready ? colors.leafTint : colors.card,
        }}
      >
        <View style={{ width: 6, backgroundColor: accent }} />
        <View style={{ flex: 1, padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: accent,
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
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                numberOfLines={2}
                style={{ fontFamily: fonts.heavy, fontSize: 15.5, lineHeight: 21, color: ready ? colors.onLeaf : colors.ink }}
              >
                {label}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text maxFontSizeMultiplier={1.4} style={[sign.plate, { fontSize: 14, color: colors.ink }]}>
                  #{order.orderCode}
                </Text>
                <Text numberOfLines={1} style={[text.footnote, { flexShrink: 1, color: colors.muted }]}>
                  {order.storefront.storefrontName}
                </Text>
              </View>
            </View>
            <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} />
          </View>
          {step >= 0 ? (
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {STEPS.map((s, i) => (
                <View
                  key={s}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i <= step ? (ready ? colors.leaf : colors.cta) : colors.sunken,
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

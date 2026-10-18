import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { LeafletMap } from '@/components/map/LeafletMap';
import { StockTag } from '@/components/status/MockBadge';
import { commerceApi, errorMessage, type CommerceCart, type MarketplaceMenuItem, type StorefrontDetail } from '@/core/api';
import { useStartChat } from '@/features/chat/hooks/useChat';
import { CART_KEY, askToSignIn, cartCount, useAddToCart, useCart, useSetCartQuantity } from '@/features/cart/cart-api';
import { CartBar, CartSheet, QtyStepper } from '@/features/cart/components/cart-parts';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVnd } from '@/utils/format';
import { LicensedBadge } from '../components/stall-parts';
import { useMenuItem, useStorefrontDetail } from '../discovery-api';
import { directionsUrl, formatDistance, ratingText, todayHoursText, vietnamWeekday, weeklySchedule } from '../discovery-format';
import { menuItemPhotos, storefrontPhotos } from '../food-photos';
import { todayStatus } from '../storefront-hours';

const go = (href: string) => router.push(href as Href);

/** The cart bar and sheet, shared by the stall and dish pages. */
function useCartChrome() {
  const { data: cart } = useCart();
  const [open, setOpen] = useState(false);
  return {
    cart,
    bar: <CartBar cart={cart} onPress={() => setOpen(true)} />,
    sheet: <CartSheet cart={cart} visible={open} onClose={() => setOpen(false)} />,
  };
}

/** A photo that falls back to the next candidate (the stall's own, then an illustrative one). */
function FallbackPhoto({ photos, style, dim }: { photos: ReturnType<typeof storefrontPhotos>; style: object; dim?: boolean }) {
  const [failed, setFailed] = useState(0);
  const photo = photos[failed];
  if (!photo) return <View style={[style, { backgroundColor: colors.sunken }]} />;
  return (
    <View style={style}>
      <Image source={photo.source} style={{ width: '100%', height: '100%', opacity: dim ? 0.45 : 1 }} contentFit="cover" transition={160} onError={() => setFailed((n) => n + 1)} />
      {photo.illustrative ? <StockTag style={{ position: 'absolute', right: 12, bottom: 12 }} /> : null}
    </View>
  );
}

/** V-C06 Quán (DISC-06): the stall as a page — cover, today, the ways on, its menu, the pavement it stands on, its week. */
export function StorefrontDetailScreen() {
  const { storefrontId } = useLocalSearchParams<{ storefrontId: string }>();
  const id = Number(storefrontId);
  const detail = useStorefrontDetail(id);
  const chrome = useCartChrome();

  if (detail.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: '' }} />
        <ListSkeleton rows={1} height={260} />
        <View style={{ padding: 16 }}>
          <ListSkeleton rows={4} height={92} />
        </View>
      </View>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
        <Stack.Screen options={{ title: 'Quán' }} />
        <ErrorState error={detail.error ?? new Error('Không tìm thấy quán.')} onRetry={() => void detail.refetch()} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StallPage detail={detail.data} cart={chrome.cart} />
      {chrome.cart?.storefrontId === id ? chrome.bar : null}
      {chrome.sheet}
    </View>
  );
}

function StallPage({ detail, cart }: { detail: StorefrontDetail; cart: CommerceCart | null | undefined }) {
  const { storefront: s, weeklyHours, menu } = detail;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const add = useAddToCart();
  const setQty = useSetCartQuantity();
  const photos = useMemo(() => storefrontPhotos({ storefrontId: s.storefrontId, storefrontName: s.storefrontName, description: s.description, categories: s.categories, imageUrl: s.imageUrl }), [s]);
  const status = todayStatus(weeklyHours, s.isOpenNow) ?? (todayHoursText(s) ? `Hôm nay mở ${todayHoursText(s)}` : null);
  const schedule = weeklySchedule(weeklyHours);
  const today = vietnamWeekday();
  const [category, setCategory] = useState<number | null>(null);
  const shown = category == null ? menu : menu.filter((c) => c.categoryId === category);
  const qtyOf = (menuItemId: number) => (cart?.storefrontId === s.storefrontId ? (cart.items.find((i) => i.menuItemId === menuItemId)?.quantity ?? 0) : 0);
  const markers = useMemo(() => [{ id: 's', latitude: s.latitude, longitude: s.longitude, label: `Ô ${s.slotCode}`, fill: colors.cta, ink: colors.white }], [s.latitude, s.longitude, s.slotCode]);
  const hasCart = cart?.storefrontId === s.storefrontId && cartCount(cart) > 0;
  const role = useAuthStore((st) => st.user?.role_code);
  const startChat = useStartChat();
  // Only a buyer may open a thread; a visitor is asked to sign in first.
  const openChat = () => {
    if (role !== 'CUSTOMER') {
      askToSignIn('Đăng nhập để nhắn tin với quán.');
      return;
    }
    if (startChat.isPending) return;
    startChat.mutate(s.storefrontId, {
      onSuccess: (c) => go(`/customer/explore/chat/${c.conversationId}`),
      onError: (e) => showToast(errorMessage(e), 'error'),
    });
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: (hasCart ? 100 : 32) + insets.bottom }}>
      <Stack.Screen options={{ title: '', headerTransparent: true, headerTintColor: colors.white, headerStyle: { backgroundColor: 'transparent' } }} />
      <View>
        <FallbackPhoto photos={photos} style={{ width, height: 280 }} />
        <LinearGradient colors={['rgba(17,28,43,0.55)', 'rgba(17,28,43,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 110 }} pointerEvents="none" />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 16, flexDirection: 'row' }}>
          {Array.from({ length: 16 }, (_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? colors.white : colors.brand }} />
          ))}
        </View>
      </View>
      <View style={{ padding: 16, gap: 14 }}>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={[text.title1, { color: colors.ink, fontFamily: fonts.heavy }]}>{s.storefrontName}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <LicensedBadge slotCode={s.slotCode} />
            <Text style={[text.footnote, { color: colors.ink }]}>{ratingText(s.communityRating, s.communityCount)}</Text>
            {formatDistance(s.distanceMeters) ? <Text style={[text.footnote, { color: colors.muted }]}>· {formatDistance(s.distanceMeters)}</Text> : null}
          </View>
          {s.description ? <Text style={[text.callout, { color: colors.muted }]}>{s.description}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.isOpenNow ? colors.leaf : colors.danger }} />
            <Text style={[text.subhead, { color: s.isOpenNow ? colors.onLeaf : colors.onDanger }]}>{s.isOpenNow ? 'Đang mở' : 'Đang đóng'}</Text>
            {status ? <Text style={[text.footnote, { color: colors.muted }]}>· {status}</Text> : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Action icon={{ sf: 'bubble.left.and.bubble.right.fill', md: 'chat' }} label={startChat.isPending ? 'Đang mở…' : 'Nhắn tin'} onPress={openChat} />
          <Action icon={{ sf: 'arrow.triangle.turn.up.right.diamond.fill', md: 'directions' }} label="Chỉ đường" onPress={() => void Linking.openURL(directionsUrl(s.latitude, s.longitude))} />
          <Action icon={{ sf: 'person.text.rectangle', md: 'badge' }} label="Hộ kinh doanh" onPress={() => go(`/customer/explore/vendors/${s.vendorId}`)} />
          <Action icon={{ sf: 'exclamationmark.bubble', md: 'report' }} label="Phản ánh" onPress={() => go(`/customer/explore/vendors/${s.vendorId}/report`)} />
        </View>

        {!s.isOpenNow ? <Banner tone="warning">Quán đang đóng. Bạn vẫn xem được món, đặt khi quán mở.</Banner> : null}

        <Text style={{ fontFamily: fonts.heavy, fontSize: 19, color: colors.ink, marginTop: 4 }}>Thực đơn</Text>
        {menu.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
            {[{ categoryId: null as number | null, categoryName: 'Tất cả' }, ...menu].map((c) => {
              const on = category === c.categoryId;
              return (
                <Pressable key={String(c.categoryId)} onPress={() => setCategory(c.categoryId)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, justifyContent: 'center', backgroundColor: on ? colors.cta : colors.card, borderWidth: on ? 0 : 1, borderColor: colors.line }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? colors.white : colors.ink }}>{c.categoryName}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {menu.length === 0 ? <Text style={[text.footnote, { color: colors.muted }]}>Quán chưa đăng món nào.</Text> : null}
        {shown.map((c) => (
          <View key={c.categoryId} style={{ gap: 10 }}>
            {menu.length > 1 ? <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.muted }}>{c.categoryName.toUpperCase()}</Text> : null}
            {c.items.map((item) => (
              <DishRow
                key={item.menuItemId}
                item={item}
                quantity={qtyOf(item.menuItemId)}
                onOpen={() => go(`/customer/explore/items/${item.menuItemId}`)}
                onAdd={() => add(item)}
                onQuantity={(n) => setQty.mutate({ menuItemId: item.menuItemId, quantity: n })}
              />
            ))}
          </View>
        ))}

        <Card padded={false}>
          <LeafletMap center={[s.latitude, s.longitude]} zoom={18} markers={markers} interactive={false} style={{ height: 140 }} />
          <View style={{ padding: 14, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SlotPlate code={s.slotCode} />
              <Text style={[text.subhead, { flex: 1, color: colors.ink }]} numberOfLines={1}>{s.zoneName}</Text>
            </View>
            <Text style={[text.footnote, { color: colors.muted }]}>{[s.address, s.wardName].filter(Boolean).join(' · ')}</Text>
            <Text style={[text.caption, { color: colors.onLeaf }]}>Ô vỉa hè do phường cấp phép. Đến đúng ô này để lấy món.</Text>
          </View>
        </Card>

        {schedule ? (
          <Card style={{ gap: 8 }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Giờ mở cửa</Text>
            {schedule.map((d) => (
              <View key={d.day} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[text.footnote, { color: colors.ink, fontFamily: d.day === today ? fonts.bold : fonts.regular }]}>{d.label}{d.day === today ? ' (hôm nay)' : ''}</Text>
                <Text style={[text.footnote, { color: d.ranges.length ? colors.ink : colors.muted, fontFamily: d.day === today ? fonts.bold : fonts.regular }, tabular]}>{d.ranges.length ? d.ranges.join(', ') : 'Nghỉ'}</Text>
              </View>
            ))}
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Action({ icon, label, onPress }: { icon: { sf: string; md: string }; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ flex: 1, minHeight: 64, gap: 5, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.sunken : colors.card })}>
      <Icon sf={icon.sf} md={icon.md} size={19} color={colors.primary} />
      <Text style={[text.caption, { color: colors.ink, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
}

/** A dish on the stall's menu: photo, name, price, ATTP mark; + or the stepper on the right. */
function DishRow({ item, quantity, onOpen, onAdd, onQuantity }: { item: MarketplaceMenuItem; quantity: number; onOpen: () => void; onAdd: () => void; onQuantity: (n: number) => void }) {
  const photos = useMemo(() => menuItemPhotos(item), [item]);
  const soldOut = item.availabilityStatus !== 'AVAILABLE';
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${item.itemName}, ${formatVnd(item.unitPrice)}${soldOut ? ', hết món' : ''}`} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card })}>
      <View>
        <FallbackPhoto photos={photos} style={{ width: 96, height: 96, borderRadius: 14, overflow: 'hidden' }} dim={soldOut} />
      </View>
      <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
        <Text style={[text.headline, { color: colors.ink }]} numberOfLines={2}>{item.itemName}</Text>
        {item.description ? <Text style={[text.caption, { color: colors.muted }]} numberOfLines={2}>{item.description}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          <View style={{ gap: 2 }}>
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.primary }, tabular]}>{formatVnd(item.unitPrice)}</Text>
            {item.foodSafetyCertified ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Icon sf="checkmark.shield.fill" md="verified_user" size={11} color={colors.leaf} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onLeaf }}>Đạt ATTP</Text>
              </View>
            ) : null}
          </View>
          {soldOut ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.muted }}>Hết món</Text>
          ) : quantity > 0 ? (
            <QtyStepper quantity={quantity} onChange={onQuantity} name={item.itemName} compact />
          ) : (
            <Pressable onPress={onAdd} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Thêm ${item.itemName} vào giỏ`} style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: pressed ? colors.ctaPressed : colors.cta, alignItems: 'center', justifyContent: 'center' })}>
              <Icon sf="plus" md="add" size={18} color={colors.white} weight="bold" />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** V-C07 Món: the dish large, how many, a note for the cook, and one button that says the total. */
export function ItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const item = useMenuItem(Number(itemId));
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const chrome = useCartChrome();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const add = useMutation({
    mutationFn: () => commerceApi.addCartItem(item.data!.menuItemId, quantity, note.trim() || undefined),
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_KEY, cart);
      showToast('Đã thêm vào giỏ');
      router.back();
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  if (item.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: '' }} />
        <ListSkeleton rows={1} height={300} />
      </View>
    );
  }
  if (item.isError || !item.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
        <Stack.Screen options={{ title: 'Món' }} />
        <ErrorState error={item.error ?? new Error('Không tìm thấy món.')} onRetry={() => void item.refetch()} />
      </View>
    );
  }
  const d = item.data;
  const soldOut = d.availabilityStatus !== 'AVAILABLE';
  const held = chrome.cart;
  const otherStall = held && held.items.length > 0 && held.storefrontId !== d.storefrontId;
  const submit = () => {
    if (!user) return askToSignIn();
    if (user.role_code !== 'CUSTOMER') return showToast('Chỉ tài khoản người mua đặt được món.', 'error');
    if (otherStall) {
      Alert.alert('Thay giỏ hàng hiện tại?', `Giỏ tại ${held.storefrontName} sẽ được thay bằng món từ ${d.storefrontName}. Mỗi đơn chỉ lấy ở một quán.`, [
        { text: 'Giữ giỏ cũ', style: 'cancel' },
        { text: 'Thay giỏ', style: 'destructive', onPress: () => add.mutate() },
      ]);
      return;
    }
    add.mutate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: '', headerTransparent: true, headerTintColor: colors.white, headerStyle: { backgroundColor: 'transparent' } }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View>
          <FallbackPhoto photos={menuItemPhotos(d)} style={{ width, height: width * 0.82 }} dim={soldOut} />
          <LinearGradient colors={['rgba(17,28,43,0.5)', 'rgba(17,28,43,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 110 }} pointerEvents="none" />
        </View>
        <View style={{ padding: 16, gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text accessibilityRole="header" style={[text.title1, { color: colors.ink, fontFamily: fonts.heavy }]}>{d.itemName}</Text>
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 24, color: colors.primary }, tabular]}>{formatVnd(d.unitPrice)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Text style={[text.footnote, { color: colors.muted }]}>{d.categoryName}</Text>
              {d.foodSafetyCertified ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.leafTint }}>
                  <Icon sf="checkmark.shield.fill" md="verified_user" size={12} color={colors.leaf} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.onLeaf }}>Đạt ATTP</Text>
                </View>
              ) : null}
              {soldOut ? <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.onDanger }}>Hết món</Text> : null}
            </View>
            {d.description ? <Text style={[text.callout, { color: colors.ink }]}>{d.description}</Text> : null}
          </View>
          <Pressable onPress={() => go(`/customer/explore/stores/${d.storefrontId}`)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card })}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="storefront.fill" md="storefront" size={19} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[text.caption, { color: colors.muted }]}>Bán tại quán</Text>
              <Text style={[text.subhead, { color: colors.ink }]}>{d.storefrontName}</Text>
            </View>
            <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} />
          </Pressable>
          {!soldOut ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
                <Text style={[text.subhead, { color: colors.ink }]}>Số lượng</Text>
                <QtyStepper quantity={quantity} onChange={(n) => setQuantity(Math.max(1, Math.min(99, n)))} name={d.itemName} />
              </View>
              <TextField label="Ghi chú cho quán" optional value={note} onChangeText={setNote} placeholder="VD: ít cay, không hành" maxLength={200} />
            </>
          ) : null}
          {otherStall ? <Banner tone="warning">Giỏ đang có {cartCount(held)} món của {held.storefrontName}. Thêm món này sẽ thay giỏ.</Banner> : null}
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 + insets.bottom }}>
        <Button
          label={soldOut ? 'Món đang hết' : user ? `Thêm vào giỏ · ${formatVnd(d.unitPrice * quantity)}` : 'Đăng nhập để thêm vào giỏ'}
          size={56}
          icon={{ sf: 'bag.badge.plus', md: 'add_shopping_cart' }}
          disabled={soldOut}
          loading={add.isPending}
          onPress={submit}
        />
      </View>
      {chrome.sheet}
    </View>
  );
}
